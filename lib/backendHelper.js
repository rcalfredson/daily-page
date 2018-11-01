/* eslint-disable no-console */
class BackendHelper {
  constuctor(request = new XMLHttpRequest()) {
    this.request = request;
  }

  syncPage(content) {
    this.request = new XMLHttpRequest();
    const url = `${backendURL}/updatePage`;
    this.request.open('POST', url);
    this.request.setRequestHeader('Content-Type', "application/json");
    this.setAuthorization();
    this.setHandlers();
    this.request.send(JSON.stringify({content: content}));
  }

  addPeer(id) {
    this.modifyPeer(id, 'POST');
  }

  removePeer(id) {
    this.modifyPeer(id, 'DELETE');
  }

  modifyPeer(id, method) {
    this.request = new XMLHttpRequest();
    const url = `${backendURL}/peerID/${id}`;
    this.request.open(method, url);
    this.setAuthorization();
    this.setHandlers();
    this.request.send();
  }

  setAuthorization() {
    this.request.setRequestHeader('Authorization', sessionID);
  }

  setHandlers() {
    this.request.onload = () => this.handleLoadedRequest();
    this.request.onerror = () => this.handleError();
  }

  handleError() {
    console.error(this.request.statusText);
  }

  handleLoadedRequest() {
    if (this.request.readyState === 4) {
      if (this.request.status === 200) {
        console.log(this.request.statusText);
      } else {
        console.error(this.request.statusText);
      }
    }
  }
}

export default BackendHelper;
