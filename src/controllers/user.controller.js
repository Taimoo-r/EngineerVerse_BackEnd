import { User } from '../models/user.models.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { ApiError } from '../utils/ApiError.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
dotenv.config();  // Make sure this is at the top


const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);  // Fix here
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        user.refreshToken = refreshToken;
        user.accessToken = accessToken;
        await user.save({ validateBeforeSave: false });
        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating Refresh & Access Token");
    }
}

// Register a new user
export const registerUser = async (req, res) => {
    try {
        // console.log("Request body:", req.body);
        const { fullName, email, username, password } = req.body;

        if ([fullName, username, email, password].some((field) => field?.trim() === "")) {
            throw new ApiError(400, "All Fields are Required");
        }

        const existedUser = await User.findOne({
            $or: [{ username }, { email }]
        });

        if (existedUser) {
            return res.status(500).json({ message: "User with this email or username already exists" });
        }

        const avatarLocalPath = req.files?.avatar?.[0]?.path;
        const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

        // console.log("Avatar file:", avatarLocalPath);
        // console.log("Cover Image file:", coverImageLocalPath);

        const avatar = await uploadOnCloudinary(avatarLocalPath).catch(err => {
            
        });

        const coverImage = await uploadOnCloudinary(coverImageLocalPath).catch(err => {
            throw new ApiError(500, "Failed to upload cover image to Cloudinary");
        });

        const user = await User.create({
            username,
            fullName,
            avatar: avatar?.url || "",
            coverImage: coverImage?.url || "",
            email,
            password,
        });
        
        console.log("User created Succefully");
        return res.status(201).json(new ApiResponse(user));
    }
        catch(error){
            console.log(error)
            res.status(500).json({ message: "Server error", error });

        }
    }
// Login a user
    export const loginUser = async (req, res) => {
        try {
            // Log the request body to check if it contains the correct data
            // console.log("Request Body:", req.body);
    
            const { email, password } = req.body;
    
            // Only check if email is present, since username is not being passed from the frontend
            if (!email) {
                throw new ApiError(404, "Email is required");
            }
    
            // Find the user by email
            const user = await User.findOne({ email });
    
            // Log the found user for debugging purposes
            console.log("Found User:", user);
    
            if (!user) {
                return res.status(404).json({ message: "No user exists with this email" });
            }
    
            // Check if the password is correct
            const isPasswordCorrect = await user.isPasswordCorrect(password);
            if (!isPasswordCorrect) {
                return res.status(401).json({ message: "Invalid credentials" });
            }
    
            // Generate tokens
            const { refreshToken, accessToken } = await generateAccessAndRefreshToken(user._id);
            console.log(accessToken)
            const loggedUser = await User.findById(user._id).select("-password -refreshToken");
    
            // Store refresh token in cookies
            // res.cookie('refreshToken', refreshToken, {
            //     httpOnly: true,
            //     secure: true,
            //     sameSite: 'None',
            //     maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            // });
            // res.cookie('accessToken', accessToken, {
            //     httpOnly: true,
            //     secure: true,
            //     sameSite: 'None',
            //     maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            // });
    
            // Optionally save the refresh token in the database
            // user.refreshToken = refreshToken;
            // await user.save();
            console.log("User Login Successful")
            // Respond with the access token
            const options = {
                httpOnly: true,
                secure: true
            }
            return res
            .status(200)
            .cookie("accessToken",accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(200,
                    {
                        user: loggedUser,refreshToken,accessToken
                    },
                    "User Logged in successful"
                )
            )
        } catch (error) {
            console.error("Login Error:", error);
            res.status(500).json({ message: "Server error", error });
        }
    };
    
// Refresh access token
export const refreshAccessToken = async (req, res) => {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
        return res.status(403).json({ message: "No refresh token provided" });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(decoded._id);

        if (!user) return res.status(403).json({ message: "Invalid refresh token" });

        const newAccessToken = user.generateAccessToken();
        res.status(200).json({ accessToken: newAccessToken });
    } catch (error) {
        return res.status(403).json({ message: "Invalid refresh token", error });
    }
};

// Logout a user
export const logoutUser = (req, res) => {
    res.clearCookie('refreshToken', { httpOnly: true, secure: true, sameSite: 'None' });
    res.status(200).json({ message: "Logged out successfully" });
};

export const changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;

        // Find the user by ID
        const user = await User.findById(req.user?._id);
        if (!user) {
            throw new ApiError(404, "User not found");
        }

        // Check if old password is correct
        const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
        if (!isPasswordCorrect) {
            throw new ApiError(400, "Invalid OLD Password");
        }

        // Hash the new password before saving
        user.password = await bcrypt.hash(newPassword, 10);

        // Save the updated user with the new password
        await user.save({ validateBeforeSave: false });

        // Optionally, you can invalidate refresh tokens here to force re-login
        user.refreshToken = undefined;  // Remove refresh token
        await user.save();  // Save user again

        // Clear the cookies for accessToken and refreshToken
        res.clearCookie("accessToken", { httpOnly: true, secure: true, sameSite: 'strict' });
        res.clearCookie("refreshToken", { httpOnly: true, secure: true, sameSite: 'strict' });

        // Respond with success
        return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully. Please log in again."));

    } catch (error) {
        // Handle errors
        console.error("Error during password change:", error);
        return res.status(error.statusCode || 500).json(new ApiResponse(error.statusCode || 500, {}, error.message || "An error occurred"));
    }
}

    export const updateProfile = async(req, res, next) => {
        try {
            const { username, fullName, skills, experience, education, projects } = req.body;
            let resumeUrl;
    
            if (req.file) {
                const cloudinaryResponse = await uploadToCloudinary(req.file.path, 'resumes');
                resumeUrl = cloudinaryResponse.secure_url;
            }
    
            const updatedUser = await User.findByIdAndUpdate(
                req.user._id,
                {
                    $set: {
                        username,
                        fullName,
                        skills,
                        experience,
                        education,
                        projects,
                        ...(resumeUrl && { resume: resumeUrl }),
                    },
                },
                { new: true, runValidators: true }
            );
    
            if (!updatedUser) throw new Error('User not found');
            res.status(200).json({
                success: true,
                message: 'Profile updated successfully!',
                user: updatedUser,
            });
        } catch (error) {
            next(error);
        }
    };

    export const viewProfile = async(req, res, next) => {
            try {
                const user = await User.findById(req.params.id).select('-password -refreshToken');
                if (!user) throw new ApiError(404, 'User not found');
                res.status(200).json(user);
            } catch (error) {
                next(error);
            }
    }
    export const GetCurrentUser = async(req, res, next) => {
        try {
            // console.log("AT Currrent User")
            const userId = req.params.id; // Get the user ID from the URL parameters
            const user = await User.findById(userId).select('-password'); // Exclude password from the response
            
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
    
            res.status(200).json(user); // Send the user data as the response
        } catch (error) {
            console.error('Error fetching user data:', error);
            res.status(500).json({ message: 'Server error', error });
        }
    }


