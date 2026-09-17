chrome.commands.onCommand.addListener(function (command) {
    console.log('Command received:', command);
    if (command === 'check-queue') {
        runCheckIfEnabled();
    } else if (command === 'toggle-enabled') {
        toggleEnabled();
    }
});

chrome.runtime.onMessage.addListener(function (message) {
    if (message.type === 'CHECK_NOW') {
        checkQueue();
    }
});

function runCheckIfEnabled() {
    chrome.storage.local.get({ enabled: true }, function (data) {
        console.log('Enabled state:', data.enabled);
        if (!data.enabled) return;
        checkQueue();
    });
}

function toggleEnabled() {
    chrome.storage.local.get({ enabled: true }, function (data) {
        var newState = !data.enabled;
        chrome.storage.local.set({ enabled: newState });

        chrome.notifications.create('', {
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'Queue Monitor',
            message: newState ? 'Turned ON' : 'Turned OFF'
        });
    });
}

function fetchQueuePage(limitstart) {
    var cacheBuster = Date.now() + Math.random();
    var url = 'https://nberm.com/administrator/index2.php?option=com_mps&task=listusartworkrequests2&limit=100&limitstart=' + limitstart + '&_cb=' + cacheBuster;
    console.log('Fetching:', url);
    return fetch(url, { credentials: 'include', cache: 'no-store' }).then(function (res) {
        console.log('Response status:', res.status, 'for limitstart', limitstart);
        return res.text();
    });
}

function extractRequestsSection(html) {
    var startMarker = 'id="unassigned-page"';
    var endMarker = 'id="escalated-page"';
    var startIdx = html.indexOf(startMarker);
    var endIdx = html.indexOf(endMarker);
    console.log('Section markers found at:', startIdx, endIdx, '(html length:', html.length, ')');
    return (startIdx !== -1 && endIdx !== -1) ? html.slice(startIdx, endIdx) : html;
}

function countLockedInSection(section) {
    var lockedMatches = section.match(/checked_out\.png/g) || [];
    return lockedMatches.length;
}

function extractTotal(section) {
    var match = section.match(/Results\s+\d+\s*-\s*\d+\s+of\s+(\d+)/);
    console.log('Total match:', match);
    return match ? parseInt(match[1], 10) : null;
}

var CHECKING_NOTIFICATION_ID = 'imprint-queue-checking';

function checkQueue() {
    console.log('checkQueue started');

       chrome.notifications.clear(CHECKING_NOTIFICATION_ID, function () {
        chrome.notifications.create(CHECKING_NOTIFICATION_ID, {
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'Design Queue',
            message: 'Checking...',
            requireInteraction: true
        });
    });

    fetchQueuePage(0).then(function (html) {
        var section = extractRequestsSection(html);
        var total = extractTotal(section);

        if (total === null) {
            console.error('Could not find total count on page - showing raw html snippet:', html.slice(0, 500));
            return;
        }

        var lockedSoFar = countLockedInSection(section);
        var totalPages = Math.ceil(total / 100);
        console.log('Total:', total, 'Locked on page 1:', lockedSoFar, 'Total pages needed:', totalPages);

        if (totalPages <= 1) {
            showNotification(total, lockedSoFar);
            return;
        }

        var pagePromises = [];
        for (var i = 1; i < totalPages; i++) {
            pagePromises.push(fetchQueuePage(i * 100));
        }

        Promise.all(pagePromises).then(function (htmls) {
            htmls.forEach(function (pageHtml) {
                var pageSection = extractRequestsSection(pageHtml);
                lockedSoFar += countLockedInSection(pageSection);
            });
            console.log('Final counts - total:', total, 'locked:', lockedSoFar);
            showNotification(total, lockedSoFar);
        });
    }).catch(function (err) {
        console.error('Queue check failed with error:', err);
    });
}

function showNotification(total, locked) {
    console.log('Showing final notification:', total, locked);
    chrome.notifications.clear(CHECKING_NOTIFICATION_ID, function () {
        chrome.notifications.create(CHECKING_NOTIFICATION_ID, {
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'Design Queue',
            message: 'Total: ' + total + ' orders  |  Locked: ' + locked
        });
    });
}