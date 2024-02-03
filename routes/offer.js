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

      if (title && price && req.files?.picture) {
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

        console.log(req.files.picture);

        if (!Array.isArray(req.files.picture)) {
          if (req.files.picture.mimetype.slice(0, 5) !== "image") {
            return res
              .status(400)
              .json({ message: "The file must be a picture" });
          }
          const result = await cloudinary.uploader.upload(
            convertToBase64(req.files.picture),
            { folder: `vinted/offers/${newOffer._id}` }
          );
          newOffer.product_image = result;
          newOffer.product_pictures.push(result);
        } else {
          for (let i = 0; i < req.files.picture.length; i++) {
            const picture = req.files.picture[i];
            if (picture.mimetype.slice(0, 5) !== "image") {
              return res
                .status(400)
                .json({ message: "The file must be a picture" });
            }
            if (i === 0) {
              const result = await cloudinary.uploader.upload(
                convertToBase64(picture),
                { folder: `vinted/offers/${newOffer._id}` }
              );
              newOffer.product_image = result;
              newOffer.product_pictures.push(result);
            } else {
              const result = await cloudinary.uploader.upload(
                convertToBase64(picture),
                { folder: `vinted/offers/${newOffer._id}` }
              );
              newOffer.product_pictures.push(result);
            }
          }
        }
        await newOffer.save();
        res.status(201).json(newOffer);
      } else {
        res
          .status(400)
          .json({ message: "Title, price and picture are required" });
      }
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

router.put(
  "/offer/modify/:id",
  isAuthenticated,
  fileUpload(),
  async (req, res) => {
    try {
      const offerToModify = await Offer.findById(req.params.id);
      const { title, description, price, condition, city, brand, size, color } =
        req.body;

      if (title) offerToModify.product_name = title;
      if (description) offerToModify.product_description = description;
      if (price) offerToModify.product_price = price;

      const detail = offerToModify.product_details;
      for (let i = 0; i < detail.length; i++) {
        if (detail[i].MARQUE) {
          if (brand) detail[i].MARQUE = brand;
        }
        if (detail[i].TAILLE) {
          if (size) detail[i].TAILLE = size;
        }
        if (detail[i].ETAT) {
          if (condition) detail[i].ETAT = condition;
        }
        if (detail[i].COULEUR) {
          if (color) detail[i].COULEUR = color;
        }
        if (detail[i].EMPLACEMENT) {
          if (city) detail[i].EMPLACEMENT = city;
        }
      }
      offerToModify.markModified("product_details");

      if (req.files?.picture) {
        await cloudinary.uploader.destroy(
          offerToModify.product_image.public_id
        );

        const result = await cloudinary.uploader.upload(
          convertToBase64(req.files.picture),
          { folder: `vinted/offers/${offerToModify._id}` }
        );

        offerToModify.product_image = result;
        newOffer.product_pictures[0] = result;
      }

      await offerToModify.save();

      res.json({ message: "Offer modified succesfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

router.delete("/offer/delete/:id", isAuthenticated, async (req, res) => {
  try {
    const offerToDelete = await Offer.findById(req.params.id);

    if (req.user._id.toString() !== offerToDelete.owner.toString()) {
      return res.status(409).json({ error: "Unauthorized" });
    }

    await cloudinary.api.delete_resources_by_prefix(
      `vinted/offers/${req.params.id}`
    );
    await cloudinary.api.delete_folder(`/vinted/offers/${req.params.id}`);

    await Offer.findByIdAndDelete(req.params.id);
    res.json({ message: "Offer has been deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/offers", async (req, res) => {
  try {
    const filters = {};
    let sorting;

    let { title, priceMin, priceMax, sort, page, limit } = req.query;

    if (sort === "price-desc") {
      sorting = { product_price: "desc" };
    } else if (sort === "price-asc") {
      sorting = { product_price: "asc" };
    }

    if (!limit) {
      limit = 20;
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

    const count = await Offer.countDocuments(filters);

    res.json({ count: count, offers: offers });
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
