const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const {
  MongoClient,
  ServerApiVersion,
  ObjectId,
  MongoUnexpectedServerResponseError,
} = require("mongodb");
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
    const submissionsCollection = client
      .db("creativeDB")
      .collection("submissions");

    // jwt related api

    // create token
    app.post("/jwt", async (req, res) => {
      try {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "1h",
        });
        res.send({ token });
      } catch (error) {
        console.error(error.message);
      }
    });

    // middlewares for verify token
    const verifyToken = (req, res, next) => {
      console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }

      const token = req.headers.authorization.split(" ")[1];

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // admin verify related api
    const verifyAdmin = async (req, res, next) => {
      console.log("hello..........");
      const user = req.user;
      const query = { email: user?.email };
      const result = await userCollection.findOne(query);
      if (!result || result?.role !== "admin") {
        return res.status(401).send({ message: "unauthorized access!!" });
      }

      next();
    };

    // verify Creator
    const verifyCreator = async (req, res, next) => {
      const user = req.user;
      const query = { email: user?.email };
      const result = await userCollection.findOne(query);
      if (!result || result?.role !== "creator") {
        return res.status(401).send({ message: "unauthorized access" });
      }
      next();
    };

    // user related API

    // save users data
    app.post("/users", async (req, res) => {
      try {
        const newUser = req.body;
        const query = { email: newUser?.email };
        const existingUser = await userCollection.findOne(query);
        if (existingUser) {
          return res.send({ message: "User already exists", insertedId: null });
        }

        const result = await userCollection.insertOne(newUser);
        console.log("user log in done", result);
        if (result.insertedId) {
          return res.send({
            message: "User created successfully",
            insertedId: result.insertedId,
          });
        } else {
          throw new Error("Insertion failed");
        }
      } catch (error) {
        console.error(error.message);
      }
    });

    //
    app.put("/user", async (req, res) => {
      try {
        const user = req.body;
        const query = { email: user?.email };
        // check if user already exists in data server
        const isExist = await userCollection.findOne(query);
        if (isExist && user.status === "Pending") {
          const result = await userCollection.updateOne(query, {
            $set: { status: user?.status },
          });
          return res.send({ success: true, result });
        } else if (isExist) {
          return res.send({ success: true, data: isExist });
        }

        // save user for the first time
        const options = { upsert: true };

        const updateDoc = {
          $set: {
            ...user,
            timestamp: Date.now(),
          },
        };

        const result = await userCollection.updateOne(
          query,
          updateDoc,
          options
        );
        res.send({ success: true, result });
      } catch (error) {
        console.log(error.message);
      }
    });
    //  get all users data
    app.get("/users", async (req, res) => {
      try {
        const result = await userCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.log(error.message);
      }
    });

    // get a user info by email form data base
    app.get("/user/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const result = await userCollection.findOne({ email });
        res.send(result);
      } catch (error) {
        console.log(error.message);
      }
    });

    // update a user role

    app.patch("/users/update/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const user = req.body;
        const query = { email };
        const updateDoc = {
          $set: {
            ...user,
            timestamp: Date.now(),
          },
        };
        const result = await userCollection.updateOne(query, updateDoc);
        res.send(result);
      } catch (error) {
        console.log(error.message);
      }
    });

    // delete user
    app.delete("/users/delete/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await userCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error deleting user:", error.message);
        console.log("Error deleting user:", error.message);
      }
    });

    // Contest related API

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

    // ----------------------------Submit-------------------------->>>>
    // save submission data
    app.post("/submit", async (req, res) => {
      try {
        const submitData = req.body;

        const result = await submissionsCollection.insertOne(submitData);

        const contestId = submitData?.contestId;
        const query = { _id: new ObjectId(contestId) };
        const updateDoc = {
          $set: { payment: "Completed" },
          $inc: { participationCount: 1 },
        };
        const updateStatus = await contestCollection.updateOne(
          query,
          updateDoc
        );

        res.send({ result, updateStatus });
      } catch (error) {
        console.error(error.message);
      }
    });

    app.get("/contest-submissions", async (req, res) => {
      try {
        const result = await submissionsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error(error.message);
      }
    });

    // Declare a winner for a specific contest submission
    app.patch("/contests/:contestId/winner/:submissionId", async (req, res) => {
      try {
        const { contestId, submissionId } = req.params;

        // Update the submission as the winner
        const updateWinner = await submissionsCollection.updateOne(
          { _id: new ObjectId(submissionId) },
          { $set: { status: "Winner" } }
        );

        // Mark other submissions as "Un-success"
        const updateOthers = await submissionsCollection.updateMany(
          { contestId, _id: { $ne: new ObjectId(submissionId) } },
          { $set: { status: "Un-success" } }
        );

        res.send({ updateWinner, updateOthers });
        console.log(updateWinner, updateOthers);
      } catch (error) {
        console.error(error.message);
        res.status(500).send({ message: "Failed to declare winner" });
      }
    });

    // get my contest after payment
    app.get("/my-participated-contest/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const query = { "user.email": email };
        const result = await submissionsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error(error.message);
      }
    });

    // ----------------------------  Created-contest.-------------------------->>>>

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
        const contestId = req.params.id;
        const query = { _id: new ObjectId(contestId) };
        // Delete contest
        await contestCollection.deleteOne(query);

        // Also delete related submission
        await submissionsCollection.deleteMany({
          contestId: new ObjectId(contestId),
        });
        res.send({ message: "Contest and related submissions deleted" });
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

    // Update Contest

    app.put(
      "/contest/update/:id",

      async (req, res) => {
        try {
          const id = req.params.id;
          const contestData = req.body;
          const query = { _id: new ObjectId(id) };
          const updateDoc = {
            $set: contestData,
          };

          const result = await contestCollection.updateOne(query, updateDoc);
          res.send(result);
          console.log("result", result);
        } catch (error) {
          console.error(error.message);
        }
      }
    );

    // confirm contest
    app.patch("/confirm-contest/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            status: "confirmed",
          },
        };
        const result = await contestCollection.updateOne(query, updateDoc);

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Contest not found" });
        }
        res.send({ message: "Contest confirmed successfully" });
      } catch (error) {
        console.error(error.messages);
        res.status(500).send({ message: "Failed to confirm contest" });
      }
    });

    // submit contest
    app.post("/contest-comment/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { comment, admin } = req.body;

        if (!comment) {
          return res.status(400).send({ message: "Comment is not required" });
        }

        // if (!req.user?.email) {
        //   return res.status(401).send({ message: "Unauthorized" });
        // }

        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $push: {
            comment: {
              comment,
              admin,
              date: new Date(),
            },
          },
        };

        const result = await contestCollection.updateOne(query, updateDoc);

        if (result.matchedCount === 0) {
          return res.status(400).send({ message: "Contest not found" });
        }
        // Send success response
        return res
          .status(200)
          .send({ message: "Comment added successfully!!" });
      } catch (error) {
        console.error(error.message);
      }
    });

    // Payment related API

    // create-payment-intent
    app.post("/create-payment-intent", async (req, res) => {
      try {
        const price = req.body.price;
        const priceInCent = parseFloat(price) * 100;
        if (!price || priceInCent < 1) return;

        // generate clientSecret
        const { client_secret } = await stripe.paymentIntents.create({
          amount: priceInCent,
          currency: "usd",
          automatic_payment_methods: {
            enabled: true,
          },
        });
        //send client secret as response
        res.send({ clientSecret: client_secret });
      } catch (error) {
        console.error(error.message);
      }
    });
    // save payment data
    app.post("/payments", async (req, res) => {
      try {
      } catch (error) {
        console.error(error.message);
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
