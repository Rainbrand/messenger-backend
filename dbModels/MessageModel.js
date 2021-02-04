import mongoose from 'mongoose'

const Schema = mongoose.Schema

const messageSchema = new Schema({
    messageText: String,
    messageRoomName: String,
    messageTime: Date,
    messageIsSystem: Boolean,
    messageSender: String
}, {collection : 'messages'})

export default mongoose.model('messages', messageSchema)
