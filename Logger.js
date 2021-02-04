class Logger{
    static eventInvoked(eventName){
        console.log(`Event '${eventName}' invoked.`)
    }

    static userConnectedToServer(id, name){
        console.log(`User ${name} with ID ${id} has connected.`)
    }

    static userLeftRoom(username, userId, room){
        console.log(`User ${username} with id ${userId} has left room ${room}.`)
    }

    static userJoinedRoom(username, userId, room){
        console.log(`User ${username} with id ${userId} has joined room ${room}.`)
    }

    static newSystemMessage(text, room){
        console.log(`New system message '${text}' to room ${room}.`)
    }

    static roomAlreadyExist(username, userId, room){
        console.log(`User ${username} with id ${userId} tried to create room '${room}' that already exists.`)
    }

    static roomCreated(username, userId, room){
        console.log(`Room ${room} has been created by user ${username} with id ${userId}.`)
    }

    static newMessageInRoom(username, userId, text, room){
        console.log(`New message '${text}' from user ${username} with id ${userId} to room ${room}.`)
    }
}

export default Logger
