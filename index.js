require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
var jwt = require("jsonwebtoken");
const app = express();
const port = process.env.port || 5000;
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Password}@cluster0.fzuzq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    const userCollections = client.db("Pet").collection("User");
    const petsCollections = client.db("Pet").collection("PetCollection");
    const adoptPetCollection = client.db("Pet").collection("AdoptPet");
    const donationCollection = client.db("Pet").collection("Donations");
    const paymentCollection = client.db("Pet").collection("Payments");
    //jwt related apis
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });
    //middleware
    //verify token
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized access" });
        }
        req.decoded = decoded;

        next();
      });
    };
    //verify Admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollections.findOne(query);
      const isAdmin = user?.role === "Admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };
    //user related apis
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollections.find().toArray();
      res.send(result);
    });
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const query = { email: email };
      const user = await userCollections.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "Admin";
      }
      res.send({ admin });
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      //check user already exist
      const query = { email: user.email };
      const existingUser = await userCollections.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exist", insertedId: null });
      }
      const result = await userCollections.insertOne(user);
      res.send(result);
    });

    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "Admin",
          },
        };
        const result = await userCollections.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );
    //All Pets API
    app.get("/all-pets", async (req, res) => {
      const { query, category } = req.query;
      let option = {};
      if (query) {
        option.name = { $regex: query, $options: "i" };
      }
      if (category) {
        option.category = category;
      }
      const pets = await petsCollections
        .find(option)
        .sort({ dateAdded: -1 })
        .toArray();
      res.send(pets);
    });
    //Specific pet details
    app.get("/all-pets/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await petsCollections.findOne(query);
      res.send(result);
    });
    // specific user pet apis
    app.get("/all-pets/email/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const filter = { user_Email: email };
      const result = await petsCollections.find(filter).toArray();
      res.send(result);
    });
    //create pets api
    app.post("/all-pets", async (req, res) => {
      const pet = req.body;
      const result = await petsCollections.insertOne(pet);
      res.send(result);
    });
    //update pet information
    app.put("/all-pets/petId/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const updatePetInfo = req.body;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: updatePetInfo,
      };
      const options = { upsert: true };
      const result = await petsCollections.updateOne(
        query,
        updatedDoc,
        options
      );
      res.send(result);
    });
    //make pet adopt apis
    app.patch("/all-pets/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          adopted: true,
        },
      };
      const result = await petsCollections.updateOne(query, updatedDoc);
      res.send(result);
    });
    app.delete("/all-pets/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await petsCollections.deleteOne(query);
      res.send(result);
    });
    //pet adoption specific get apis
    app.get("/adopt-pet/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { petOwnerEmail: email };
      const adoptPet = await adoptPetCollection.find(filter).toArray();
      res.send(adoptPet);
    });
    //pet adoption post apis
    app.post("/adopt-pet", async (req, res) => {
      const adoptPet = req.body;
      // if a user already adopt this pet
      const query = { userEmail: adoptPet.userEmail, petId: adoptPet.petId };
      const alreadyExist = await adoptPetCollection.findOne(query);
      if (alreadyExist)
        return res.status(400).send("You already adopt this pet");

      const result = await adoptPetCollection.insertOne(adoptPet);
      res.send(result);
    });
    // pet adoption request accept or reject
    app.patch("/adopt-pet/:id", async (req, res) => {
      const id = req.params.id;
      const { adopted } = req.body;
      const query = { _id: new ObjectId(id) };
      const filter = { petId: id };
      const updatedDoc = {
        $set: {
          adopted: adopted,
        },
      };
      let adoptUpdate;

      if (adopted) {
        adoptUpdate = {
          $set: {
            adopted: "Adopted",
          },
        };
      } else {
        adoptUpdate = {
          $set: {
            adopted: "Not Adopted",
          },
        };
      }

      const result = await petsCollections.updateOne(query, updatedDoc);
      const final = await adoptPetCollection.updateOne(filter, adoptUpdate);
      res.send({
        petsCollectionResult: result,
        adoptPetCollectionResult: final,
      });
    });
    //donation pets apis
    app.get("/donation-campaign", async (req, res) => {
      const pets = await donationCollection
        .find()
        .sort({ campaignCreatedDateTime: -1 })
        .toArray();
      res.send(pets);
    });
    app.get("/donation-campaign/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationCollection.findOne(query);
      res.send(result);
    });
    //specific donation apis
    app.get("/donation-user-campaign/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { userEmail: email };
      const donator = await donationCollection.find(filter).toArray();
      res.send(donator);
    });
    // make donation post apis
    app.post("/donation-campaign", async (req, res) => {
      const donationCampaign = req.body;
      const result = await donationCollection.insertOne(donationCampaign);
      res.send(result);
    });
    //update donation pet information
    app.put("/donation-campaign/petId/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const updatePetInfo = req.body;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: updatePetInfo,
      };
      const options = { upsert: true };
      const result = await donationCollection.updateOne(
        query,
        updatedDoc,
        options
      );
      res.send(result);
    });
    app.patch("/donation-campaign/pause/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          pause: true,
        },
      };
      const result = await donationCollection.updateOne(query, updatedDoc);
      res.send(result);
    });
    //payment intent
    app.post("/create-payment-intent",  async (req, res) => {
      const {amount} = req.body;
      const donationAmount = parseInt(amount * 100);
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: donationAmount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
      
    });
    //payment info pet specific
    app.get('/payment/petId/:id', async(req, res)=>{
      const id = req.params.id;
      const filter = { petId: id   }
      const donator = await paymentCollection.find(filter).toArray();
      res.send(donator);
    })
    //payment info get apis
    app.get('/payment/:email', async(req, res)=>{
      const email = req.params.email;
      const filter = { donatorEmail: email }
      const donator = await paymentCollection.find(filter).toArray();
      res.send(donator);
    })
  //  payment info post apis
  app.post('/payments', async(req, res)=>{
    const payment = req.body;
    // accumulate donated amount
    const filter = {_id : new ObjectId(payment.petId)}
    const update={
      $inc:{donatedAmount: payment.donationAmount}
    }
    const result = await paymentCollection.insertOne(payment);
    const updateDonatedAmount = await donationCollection.updateOne(filter, update)
    res.send(result);
  })
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
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
  res.send("So many pets is upcoming");
});

app.listen(port, () => {
  console.log(`This port is running ${port}`);
});
