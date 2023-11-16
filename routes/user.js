const express = require("express");
const router = express.Router();
const SHA256 = require("crypto-js/sha256");
const enBase64 = require("crypto-js/enc-base64");
const uid2 = require("uid2");
const fileUpload = require("express-fileupload");
const cloudinary = require("cloudinary").v2;
const convertToBase64 = require("../middlewares/convertToBase64");

const User = require("../models/User");

router.post("/user/signup", fileUpload(), async (req, res) => {
  try {
    if (!req.body.username) {
      res.status(400).json({ message: "Username is missing" });
      return;
    }
    const user = await User.findOne({ email: req.body.email });
    if (user) {
      res.status(409).json({ message: "User already exists" });
    } else {
      const password = req.body.password;
      const salt = uid2(24);
      const hash = SHA256(password + salt).toString(enBase64);
      const token = uid2(24);

      const newUser = new User({
        email: req.body.email,
        account: {
          username: req.body.username,
        },
        newsletter: req.body.newsletter,
        token: token,
        hash: hash,
        salt: salt,
      });

      if (req.files) {
        const pictureToUpload = req.files.picture;
        const result = await cloudinary.uploader.upload(
          convertToBase64(pictureToUpload),
          { folder: `vinted/users/${newUser._id}` }
        );

        newUser.account.avatar = result;
      }

      await newUser.save();
      res.status(201).json({
        _id: newUser._id,
        token: newUser.token,
        account: newUser.account,
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/user/login", async (req, res) => {
  try {
    if (!req.body.email || !req.body.password) {
      res
        .status(400)
        .json({ message: "Email address or password is incorrect" });
      return;
    }
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      res
        .status(400)
        .json({ message: "Email address or password is incorrect" });
      return;
    } else {
      const newHash = SHA256(req.body.password + user.salt).toString(enBase64);
      if (newHash !== user.hash) {
        res
          .status(401)
          .json({ message: "Email address or password is incorrect" });
        return;
      } else {
        res.json({
          _id: user._id,
          token: user.token,
          account: user.account,
        });
      }
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
