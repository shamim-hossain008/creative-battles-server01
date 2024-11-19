const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5070;

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5173"],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bsdzgwr.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("creativeDB").collection("users");
    const contestCollection = client.db("creativeDB").collection("Contest");

    // jwt related api

    // create token
    app.post("/jwt", async (req, res) => {
      try {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expireIn: "1h",
        });
        res.send({ token });
      } catch (error) {
        console.log(error.message);
      }
    });

    // user related API

    // save users data
    app.post("/users", async (req, res) => {
      try {
        const newUser = req.body;
        const query = { email: newUser.email };
        const existingUser = await userCollection.findOne(query);
        if (existingUser) {
          return res.send({ message: "User already exists", insertedId: null });
        }

        const result = await userCollection.insertOne(newUser);
        res.send(result);
      } catch (error) {
        console.log(error.message);
      }
    });

    //  get users data
    app.get("/users", async (req, res) => {
      try {
        const result = await userCollection.find().toArray();
        res.send(result);
        console.log("from database user", result);
      } catch (error) {
        console.log(error.message);
      }
    });

    // get all Contest data
    app.get("/all-contest", async (req, res) => {
      try {
        const result = await contestCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.log(error.message);
      }
    });

    // get popular contest data
    app.get("/popular-contest", async (req, res) => {
      try {
        const result = await contestCollection
          .find({})
          .sort({ participationCount: -1 })
          .limit(5)
          .toArray();
        res.send(result);
      } catch (error) {
        console.log(error.massager);
      }
    });

    // get a single contest data
    app.get("/contest/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await contestCollection.findOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        console.log(error.massage);
        res.status(500).send({ message: "Failed to fetch contest id" });
      }
    });

    // get contest data by email
    app.get("/my-created-contest/:email", async (req, res) => {
      try {
        const email = req.params.email;
        let query = { "creator.email": email };
        const result = await contestCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.log(error.message);
        res.status(500).send({ message: "Failed to fetch contest list email" });
      }
    });

    // Delete Contest from data server
    app.delete("/my-created-contest/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await contestCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.log(error.message);
        res.status(500).send({ message: "Failed to fetch contest delete" });
      }
    });

    // save Contest data

    app.post("/add-contest", async (req, res) => {
      try {
        const contestData = req.body;

        const result = await contestCollection.insertOne(contestData);
        res.send(result);
      } catch (error) {
        console.log(error.message);
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Creative-Battles is here");
});

app.listen(port, () => {
  console.log(
    `Creative-Battles server is running.....................!! ${port}`
  );
});
