require('dotenv').config()
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
  }
});

async function run() {
  try {
    const petsCollections = client.db('Pet').collection('PetCollection');
    const adoptPetCollection = client.db('Pet').collection('AdoptPet')
    const donationCollection = client.db('Pet').collection('Donations')
    //All Pets API
    app.get('/all-pets', async(req, res)=>{
      const { query, category } = req.query;
      let option ={}
      if(query){
        option.name= { $regex: query, $options: 'i' };
      }
      if(category){
        option.category= category;
      }
        const pets = await petsCollections.find(option).sort({dateAdded:-1}).toArray();
        res.send(pets);
    })
    //Specific pet details
    app.get('/all-pets/:id', async(req,res)=>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await petsCollections.findOne(query);
        res.send(result);
    })
     app.delete('/all-pets/:id',async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await petsCollections.deleteOne(query);
      res.send(result);
     })
    //pet adoption post apis
    app.post('/adopt-pet', async(req, res)=>{
      const adoptPet = req.body;
      const result  = await adoptPetCollection.insertOne(adoptPet);
      res.send(result);
    })

    //donation pets apis 
    app.get('/donation-campaign', async(req, res)=>{
      const pets = await donationCollection.find().sort({campaignCreatedDateTime: -1}).toArray();
      res.send(pets);
    })
    app.get('/donation-campaign/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await donationCollection.findOne(query);
      res.send(result)
    })
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
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