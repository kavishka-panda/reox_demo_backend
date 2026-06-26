const { AsyncLocalStorage } = require('async_hooks');

const outboxContext = new AsyncLocalStorage();

function runWithOutboxHandled(operation) {
    return outboxContext.run({ outboxHandledByDualWrite: true }, operation);
}

function isOutboxHandledByDualWrite() {
    return !!outboxContext.getStore()?.outboxHandledByDualWrite;
}

module.exports = {
    runWithOutboxHandled,
    isOutboxHandledByDualWrite
};
