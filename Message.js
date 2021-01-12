class Message{
    constructor(text, roomName, sender="system") {
        this.time = new Date().toUTCString()
        this.text = text
        this.sender = sender
        this.roomName = roomName
    }
}
