class BackendHelper {
  addPeer(id) {
    this.modifyPeer(id, 'POST')
  }

  removePeer(id) {
    this.modifyPeer(id, 'DELETE');
  }

  modifyPeer(id, method) {
    const request = new XMLHttpRequest();
    const url = `${backendURL}/peerID/${id}`;
    request.open(method, url);
    this.setAuthorization(request);
    request.onload = () => this.handleLoadedRequest(request);
    request.onerror = () => this.handleError(request);
    request.send();
  }

  setAuthorization(request) {
    request.setRequestHeader('Authorization', sessionID);
  }

  handleError(request) {
    console.error(request.statusText);
  }

  handleLoadedRequest(request) {
    if (request.readyState === 4) {
      if (request.status === 200) {
        console.log(request.statusText);
      } else {
        console.error(request.statusText);
      }
    }
  }
}

export default BackendHelper;
