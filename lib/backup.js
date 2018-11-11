import UUID from 'uuid/v1';

class Backup {
  constructor() {
    this.lastUpdated = new Date().getTime();
    this.lastMessageID = UUID();
    this.pendingRequests = 0;
  }

  updateMessageID(id = UUID()) {
    this.lastMessageID = id;
  }
}

export default Backup;
