import mongoose, {Schema} from "mongoose";
const postSchema = new Schema({
    file: {
        type: String,
        required: true
    },
    text: {
        type: String
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    likes: {
        type: [mongoose.Schema.Types.ObjectId], // Array of user IDs who liked the post
        default: []
    },
    comments: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: [],
            required: true
        },
        content: {
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
}, { timestamps: true });


export const Post = mongoose.model("postSchema", postSchema);