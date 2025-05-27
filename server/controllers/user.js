const User = require('../models/user');

const register = async (req, res) => {
  try {
    const { fullname, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Create and save user
    const newUser = new User({ fullname, email, password });
    await newUser.save();

    res.status(201).json({ message: 'User registered successfully', fullname, email , password });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const login = (req,res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }

    User.findOne({ email })
        .then((user) => {
            if (!user) {
                return res.status(400).json({ message: "Invalid email or password" });
            }

            if (user.password !== password) {
                return res.status(400).json({ message: "Invalid email or password" });
            }

            res.status(200).json({ message: "Login successful", fullname : user.fullname , email : user.email , password : user.password });
        })
        .catch((err) => {
            console.error("Login error:", err);
            res.status(500).json({ message: "Internal server error" });
        });
}

module.exports = {
    register,
    login,
}