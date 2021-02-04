export class Message{
    constructor(text, roomName) {
        this.text = text;
        this.roomName = roomName;
        this.timestamp = new Date().toUTCString();
        this.isSystem = true;
    }

    toJson(){
        return {
            messageText: this.text,
            messageRoomName: this.roomName,
            messageTime: this.timestamp,
            messageIsSystem: this.isSystem
        }
    }

}

export class UserMessage extends Message{
    constructor(text, roomName, sender) {
        super(text, roomName);
        this.isSystem = false;
        this.sender = sender;
    }

    toJson(){   //TODO: refactor
        return {
            messageId: this.id,
            messageTime: this.timestamp,
            messageRoomName: this.roomName,
            messageText: this.text,
            messageSender: this.sender,
            messageIsSystem: this.isSystem
        }
    }
}


export default {Message, UserMessage}
