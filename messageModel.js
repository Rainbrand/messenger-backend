import mongoose from 'mongoose'

const Schema = mongoose.Schema

const messageSchema = new Schema({
    messageText: String,
    messageRoomName: String,
    messageTime: Date,
    messageSystem: Boolean,
    messageSender: String
}, {collection : 'messages'})

export default mongoose.model('messages', messageSchema)
