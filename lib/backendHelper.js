/* eslint-disable no-console */
class BackendHelper {
  constuctor(request = new XMLHttpRequest()) {
    this.request = request;
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
    this.request.onload = () => this.handleLoadedRequest();
    this.request.onerror = () => this.handleError();
    this.request.send();
  }

  setAuthorization() {
    this.request.setRequestHeader('Authorization', sessionID);
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
