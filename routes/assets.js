var express = require('express');
var router = express.Router();
var AWS = require("aws-sdk");

AWS.config.update({
    region: "eu-west-2",
    endpoint: "http://localhost:8000"
});
var res = null;

var docClient = new AWS.DynamoDB.DocumentClient();

router.get('/', async function (req, res, next) {
    res.send({ title: "Cars API Entry Point" })
});

var CUSTOMEPOCH = 1300000000000; // artificial epoch
function generateRowId(shardId /* range 0-64 for shard/slot */) {
    var ts = new Date().getTime() - CUSTOMEPOCH; // limit to recent
    var randid = Math.floor(Math.random() * 512);
    ts = (ts * 64);   // bit-shift << 6
    ts = ts + shardId;
    return (ts * 512) + (randid % 512);
}

/* adds a new customer to the list */
router.post('/addAsset', async (req, res, next) => {
    const body = req.body;

    try {
        var params = {
            TableName: "Cars",
            Item: {
                "id": generateRowId(4),
                "type": body.type,
                "name": body.name,
                "manufacturer": body.manufacturer,
                "fuel_type": body.fuelType,
                "description": body.description
            }
        };
        docClient.put(params, function (err, data) {
            if (err) {
                console.error("Unable to add asset", body.name, ". Error JSON:", JSON.stringify(err, null, 2));
            } else {
                console.log("PutItem succeeded:", body.name);
            }
        });

        // created the customer! 
        return res.status(201).json({ body });
    }
    catch (err) {
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: err.message });
        }

        // unexpected error
        return next(err);
    }
});

router.get('/listAll', async function (req, res) {


    var params = {
        TableName: "Cars",
        ProjectionExpression: "#id, #name, #type, #manufacturer, #fuel_type, #description",
        ExpressionAttributeNames: {
            "#id": "id",
            "#name": "name",
            "#type": "type",
            "#manufacturer": "manufacturer",
            "#fuel_type": "fuel_type",
            "#description": "description"
        }
    };

    console.log("Scanning Cars table.");
    docClient.scan(params, onScan);

    function onScan(err, data) {
        if (err) {
            console.error("Unable to scan the table. Error JSON:", JSON.stringify(err, null, 2));
        } else {
            res.send(data)
            // print all the Cars
            console.log("Scan succeeded.");
            data.Items.forEach(function (car) {
                console.log(car.id, car.type, car.name)
            });

            if (typeof data.LastEvaluatedKey != "undefined") {
                console.log("Scanning for more...");
                params.ExclusiveStartKey = data.LastEvaluatedKey;
                docClient.scan(params, onScan);
            }
        }
    }
});

module.exports = router;
