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

// verify Token Middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  console.log(token);

  if (!token) {
    return res.status(401).send({ message: "unauthorized access...." });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

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
    const paymentCollection = client.db("creativeDB").collection("payments");

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

    // jwt related api

    // create token
    app.post("/jwt", async (req, res) => {
      try {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {});
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

    //
    app.put("/user", async (req, res) => {
      try {
        const user = req.body;
        const query = { email: user?.email };
        // check if user already exists in data server
        const isExist = await userCollection.findOne(query);
        if (isExist) {
          if (user.status === "Pending") {
            const result = await userCollection.updateOne(query, {
              $set: { status: user?.status },
            });
            return res.send(result);
          } else {
            return res.send(isExist);
          }
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
        res.send(result);
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
    // ----------------------------  ............-------------------------->>>>
    // save submission data
    app.post("/submit", async (req, res) => {
      try {
        const submitData = req.body;
        console.log(submitData);
        const result = await submissionsCollection.insertOne(submitData);

        const contestId = submitData?.contestId;
        const query = { _id: new ObjectId(contestId) };
        const updateDoc = {
          $set: { status: "accepted" },
        };
        const updateStatus = await contestCollection.updateOne(
          query,
          updateDoc
        );
        console.log(updateStatus);
        res.send(result, updateStatus);
      } catch (error) {
        console.error(error.message);
      }
    });

    // get submitted contest

    app.get("/contest/:contestId/submissions", async (req, res) => {
      try {
        const { contestId } = req.params;
        console.log(contestId);

        // Validate contestId format
        if (!contestId || !ObjectId.isValid(contestId)) {
          return res.status(400).send({ message: "Invalid contest ID format" });
        }

        const query = { contestId: new ObjectId(contestId) }; // Safe to convert now

        const submissions = await submissionsCollection
          .find(query)
          .project({ participantName: 1, email: 1, taskLink: 1, status: 1 })
          .toArray();

        if (submissions.length === 0) {
          return res
            .status(404)
            .send({ message: "No submissions found for this contest" });
        }

        res.send({ totalSubmission: submissions.length, data: submissions });

        console.log(
          `Fetched ${submissions.length} submissions for contestId: ${contestId}`
        );
      } catch (error) {
        console.error(error.message);
        res.status(500).send({ message: "Failed to fetch submissions" });
      }
    });

    // Correct path for handling contest submissions
    app.post("/contests/:contestId/submit", async (req, res) => {
      const { contestId } = req.params.contestId; // From URL
      const submissionData = {
        ...req.body,
        contestId: new ObjectId(contestId),
      }; // Convert to ObjectId
      try {
        const result = await submissionsCollection.insertOne(submissionData);
        res.status(201).send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Submission failed", error: error.message });
      }
    });

    // Declare a Winner for a Contest
    app.patch("/contests/:contestId/winner/:submissionId", async (req, res) => {
      try {
        const { contestId, submissionId } = req.params;

        // set all submissions to "Un-success"
        await submissionsCollection.updateMany(
          { contestId: new ObjectId(contestId) },
          { $set: { status: "Un-success" } }
        );

        // Mark the selected submission as the winner
        const result = await submissionsCollection.updateOne(
          { _id: new ObjectId(submissionId) },
          { $set: { status: "Winner" } }
        );

        res.send(result);
      } catch (error) {
        console.error(error.message);
        res.status(500).send({ message: "Failed to declare winner" });
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
