
// Central event hub for decoupling

const eventHub = {
  listeners: {},   //The "Address Book"

  on(event, callback) {
    // check if that event has been added to the "Address Book" i fnot add it
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  },

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

}


export { eventHub };