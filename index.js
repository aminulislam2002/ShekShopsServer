const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ovqmul2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// JWT verify code
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.JWT_ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("ShekShops");
    const productsCollection = database.collection("products");
    const ordersCollection = database.collection("orders");
    const usersCollection = database.collection("users");

    app.get("/", (req, res) => {
      res.send("Hello World!");
    });

    // JWT TOKEN POST
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_ACCESS_TOKEN, { expiresIn: "1h" });
      res.send({ token });
    });

    // Get admin by email
    app.get("/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    // Get customer by email
    app.get("/customer/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ customer: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { customer: user?.role === "customer" };
      res.send(result);
    });

    // GET all products
    app.get("/products", async (req, res) => {
      const result = await productsCollection.find().toArray();
      res.send(result);
    });

    // Get a product by id
    app.get("/product/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await productsCollection.findOne(filter);
      res.send(result);
    });

    // GET all orders
    app.get("/orders", async (req, res) => {
      const result = await ordersCollection.find().toArray();
      res.send(result);
    });

    // GET all users
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // GET orders by email
    app.get("/order", async (req, res) => {
      try {
        const email = req.query.email;
        console.log(email);
        const query = { "customerData.email": email };
        const userOrders = await ordersCollection.find(query).toArray();
        res.send(userOrders);
      } catch (error) {
        console.error("Error fetching user orders:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // POST a product
    app.post("/postProduct", async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      res.send(result);
    });

    // POST a order
    app.post("/postOrder", async (req, res) => {
      const product = req.body;
      const result = await ordersCollection.insertOne(product);
      res.send(result);
    });

    // POST an user
    app.post("/postUser", async (req, res) => {
      const user = req.body;
      console.log(user);
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // Update a product
    app.patch("/updateProduct/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateProductInfo = req.body;

        // Extract the fields that need to be updated
        const { name, description, category, productType, sizes, colors, originalPrice, offerPrice, ratings, reviews } =
          updateProductInfo;

        // Create an object to store only the fields that need to be updated
        const updateFields = {};
        if (name) updateFields.name = name;
        if (description) updateFields.description = description;
        if (category) updateFields.category = category;
        if (productType) updateFields.productType = productType;
        if (sizes) updateFields.sizes = sizes;
        if (colors) updateFields.colors = colors;
        if (originalPrice) updateFields.originalPrice = originalPrice;
        if (offerPrice) updateFields.offerPrice = offerPrice;
        if (ratings) updateFields.ratings = ratings;
        if (reviews) updateFields.reviews = reviews;

        // Check if images are provided in the request body
        if (updateProductInfo.images && updateProductInfo.images.length > 0) {
          updateFields.images = updateProductInfo.images;
        }

        // Check if colors are provided in the request body
        if (updateProductInfo.colors && updateProductInfo.colors.length > 0) {
          updateFields.colors = updateProductInfo.colors;
        }

        // Check if sizes are provided in the request body
        if (updateProductInfo.sizes && updateProductInfo.sizes.length > 0) {
          updateFields.sizes = updateProductInfo.sizes;
        }

        const updateDoc = {
          $set: updateFields,
        };

        const result = await productsCollection.updateOne(filter, updateDoc);

        res.send(result);
      } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // Update order status
    app.put("/orderStatus/:id", async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      try {
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { orderStatus: status } };

        const result = await ordersCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          // If no document matched the provided ID
          return res.status(404).json({ message: "Order not found" });
        }

        res.status(200).json({ message: "Order status updated successfully" });
      } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({ message: "Failed to update order status" });
      }
    });

    // DELETE a product
    app.delete("/deleteProduct/:id", async (req, res) => {
      const productId = req.params.id;
      const query = { _id: new ObjectId(productId) };
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    });

    // DELETE a order
    app.delete("/deleteOrder/:id", async (req, res) => {
      const productId = req.params.id;
      const query = { _id: new ObjectId(productId) };
      const result = await ordersCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`ShekShops Server running on port ${port}`);
});
