var toggle = document.getElementById('toggle');
var dot = document.getElementById('dot');
var checkNowBtn = document.getElementById('checkNow');

function refreshDot(enabled) {
    dot.classList.toggle('on', enabled);
}

chrome.storage.local.get({ enabled: true }, function (data) {
    toggle.checked = data.enabled;
    refreshDot(data.enabled);
});

toggle.addEventListener('change', function () {
    chrome.storage.local.set({ enabled: toggle.checked });
    refreshDot(toggle.checked);
});

checkNowBtn.addEventListener('click', function () {
    chrome.runtime.sendMessage({ type: 'CHECK_NOW' });
});