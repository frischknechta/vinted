const express = require("express");
const router = express.Router();
const fileUpload = require("express-fileupload");
const cloudinary = require("cloudinary").v2;
const convertToBase64 = require("../middlewares/convertToBase64");

const Offer = require("../models/Offer");
const isAuthenticated = require("../middlewares/isAuthenticated");

router.post(
  "/offer/publish",
  isAuthenticated,
  fileUpload(),
  async (req, res) => {
    try {
      const { title, description, price, condition, city, brand, size, color } =
        req.body;

      if (title.length > 50) {
        return res
          .status(400)
          .json({ message: "Maximum title length is 50 characters" });
      } else if (description.length > 500) {
        return res
          .status(400)
          .json({ message: "Maximum description length is 500 characters" });
      } else if (price > 100000) {
        return res
          .status(400)
          .json({ message: "Maximum price is 100000 Euros" });
      }

      const newOffer = new Offer({
        product_name: title,
        product_description: description,
        product_price: price,
        product_details: [
          { MARQUE: brand },
          { TAILLE: size },
          { ETAT: condition },
          { COULEUR: color },
          { EMPLACEMENT: city },
        ],
        owner: req.user,
      });

      if (req.files) {
        const pictureToUpload = req.files.picture;
        const result = await cloudinary.uploader.upload(
          convertToBase64(pictureToUpload),
          { folder: `vinted/offers/${newOffer._id}` }
        );

        newOffer.product_image = result;
      }

      await newOffer.save();
      res.status(201).json(
        newOffer
        //   {
        //   _id: newOffer._id,
        //   product_name: newOffer.product_name,
        //   product_description: newOffer.product_description,
        //   product_price: newOffer.product_price,
        //   product_details: newOffer.product_details,
        //   owner: req.user,
        //   product_image: newOffer.product_image,
        // }
      );
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

router.put("/offer/modify", isAuthenticated, fileUpload(), async (req, res) => {
  try {
    const { title, description, price, condition, city, brand, size, color } =
      req.body;
    const offerToModify = await Offer.findById(req.body.id);

    if (title) offerToModify.product_name = title;
    if (description) offerToModify.product_description = description;
    if (price) offerToModify.product_price = price;
    if (condition) offerToModify.product_details[2].ETAT = condition;
    if (city) offerToModify.product_details[4].EMPLACEMENT = city;
    if (brand) offerToModify.product_details[0].MARQUE = brand;
    if (size) offerToModify.product_details[1].TAILLE = size;
    if (color) offerToModify.product_details[3].COULEUR = color;
    if (req.files) {
      const pictureToUpload = req.files.picture;
      const result = await cloudinary.uploader.upload(
        convertToBase64(pictureToUpload),
        { folder: `vinted/offers/${offerToModify._id}` }
      );

      offerToModify.product_image.secure_url1 = result.secure_url;
    }

    console.log(offerToModify.product_details[1].TAILLE);
    await offerToModify.save();

    res.json({
      _id: offerToModify._id,
      product_name: offerToModify.product_name,
      product_description: offerToModify.product_description,
      product_price: offerToModify.product_price,
      product_details: offerToModify.product_details,
      owner: {
        account: offerToModify.owner.account,
        _id: offerToModify.owner._id,
      },
      product_image: offerToModify.product_image,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/offer/delete", isAuthenticated, async (req, res) => {
  try {
    const offerToDelete = await Offer.findById(req.query.id);

    if (req.user._id.toString() !== offerToDelete.owner.toString()) {
      return res.status(409).json({ error: "Unauthorized" });
    }

    const public_id = offerToDelete.product_image.public_id;

    await cloudinary.api.delete_resources(public_id);
    await cloudinary.api.delete_folder(`/vinted/offers/${offerToDelete._id}`);

    await Offer.findByIdAndDelete(req.query.id);
    res.json({ message: "Offer has been deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/offers", async (req, res) => {
  try {
    const limit = 10;
    const filters = {};
    let sorting;

    let { title, priceMin, priceMax, sort, page } = req.query;

    if (sort === "price-desc") {
      sorting = { product_price: "desc" };
    } else if (sort === "price-asc") {
      sorting = { product_price: "asc" };
    }

    if (!page) {
      page = 1;
    }

    if (title) {
      filters.product_name = new RegExp(title, "i");
    }

    if (priceMax && priceMin) {
      filters.product_price = { $lte: priceMax, $gte: priceMin };
    } else if (priceMax) {
      filters.product_price = { $lte: priceMax };
    } else if (priceMin) {
      filters.product_price = { $gte: priceMin };
    }

    console.log(filters);
    const offers = await Offer.find(filters)
      .sort(sorting)
      .limit(limit)
      .skip((page - 1) * limit)
      .populate("owner", "account");
    res.json({ count: offers.length, offers: offers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/offer/:id", async (req, res) => {
  try {
    console.log(req.params);
    const offer = await Offer.findById(req.params.id).populate(
      "owner",
      "account"
    );
    res.json(offer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
