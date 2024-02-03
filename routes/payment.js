const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SK);

router.post("/pay", async (req, res) => {
  const stripeToken = req.body.stripeToken;
  const price = req.body.price * 100;
  const title = req.body.title;
  console.log(stripeToken, price, title);

  const response = await stripe.charges.create({
    amount: price,
    currency: "eur",
    description: title,
    source: stripeToken,
  });
  console.log(response.status);
  res.status(200).json(response);
});

module.exports = router;
