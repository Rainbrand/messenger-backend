import express from 'express'
import * as http from 'http'
import SocketHandler from './SocketHandler.js'
import mongoose from "mongoose";

const app = express()
const server = http.createServer(app)
const socketHandler = new SocketHandler(server, "http://localhost:3000")
const PORT = 9000
const mongoosePort = 27017

const mongoURI = `mongodb://db_admin:password@localhost:${mongoosePort}/messenger-mern`

mongoose.connect(mongoURI, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("Mongoose connected"))


app.use(express.json())
app.use(express.urlencoded())
app.use(express.text())
app.use(express.raw())


socketHandler.handleConnection();

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`))
