// Entry point for the dashboard frontend.
// Loaded from index.html as <script type="module">.
//
// Side-effect imports run every part's top-level code in order.
// The window bridge then attaches the functions that inline HTML
// handlers call — module scope is not the global scope.

import './01-foundation.mjs';
import './02-ui-shell.mjs';
import './03-mod-tools.mjs';
import './04-tickets.mjs';
import './05-auto-mod.mjs';
import './06-reaction-roles.mjs';
import './07-voice.mjs';
import './08-temp-vc.mjs';
import './09-activity.mjs';
import './10-polls.mjs';

import { addDashUserUI, alertSrvChanged, backSrv, backupNow, cancelGw, clearBrandAsset, createGwUI, delBackup, dlBackup, endGw, errClearLog, errLoadMore, errSetFilter, errToggleStack, exportBotConfig, exportConfig, exportStats, filterCommands, filterServers, loadAudit, loadBackups, loadDashUsers, loadErrorAlert, loadErrors, loadGiveaways, loadServers, logout, populateGwServers, previewBg, previewBgBlur, previewBorder, previewColor, previewFont, previewRadius, previewTitle, removeDashUserUI, rerollGw, saveErrorAlert, saveSettings, saveUserScopes, setLook, showSrv, showToast, togW, toggleBgType, toggleLogCat, toggleMobileMenu, toggleTheme, toggleUserScopes, updateBotAvatar, updateBotName, updateBotPresence, uploadBgFile, uploadBrandAsset } from './01-foundation.mjs';
import { addTrackedChannel, clearTrackedChannels, msgSearchFilterChange, onMsgSearchInput, palRun, removeTrackedChannel, resetGreetingConfig, saveAllLogSettings, saveGreetingConfig, saveSrvSettings, showSec, showSrvTab, toggleGreeting, updatePreview } from './02-ui-shell.mjs';
import { addSrvNote, banSrvMember, kickSrvMember, loadInsights, loadInvites, loadMemberProfile, loadMod, loadMpServers, loadSrvNotes, searchMembers, timeoutSrvMember, toggleCompact, warnSrvMember } from './03-mod-tools.mjs';
import { addTicketType, createTicketPanel, deleteTicketType, editQuestions, editTicketTypeSettings, loadTickets, previewTicketPanel, ticketSetLog, ticketToggle, ticketToggleLeave, tkClonePanel, tkCloseModal, tkDeletePanel, tkEditMessage, tkEditPanel, tkMarkUnsaved, tkPrevCreate, tkPrevPick, tkRecFilterSet, tkRenamePanel, tkResetChanges, tkSaveChanges, tkSetCount, tkToggleFreq, tkToggleRoleChip } from './04-tickets.mjs';
import { addAMFilter, bulkAMFilter, deleteAMFilter, exportAMConfig, importAMConfig, loadAutomod, saveAMChannels, saveAMRoles, saveAMRule, toggleAMChanMode, toggleAMChannel, toggleAMRole, toggleAMRule, uploadTxtFilter } from './05-auto-mod.mjs';
import { addRoleMenuOptionUI, createReactionRoleUI, createRoleMenuUI, deleteReactionRole, deleteRoleMenu, editRoleMenuUI, loadReactionRoles, loadRoleMenus, publishRoleMenuUI, removeRoleMenuOptionUI, saveRoleMenuTitle } from './06-reaction-roles.mjs';
import { createApiToken, deleteApiToken, deleteWebhook, joinVoicePresence, joinVoicePresenceUI, leaveVoicePresence, loadVoicePresence, loadWebhooks, moveVoicePresence, moveVoicePresenceUI, setVoicePresenceStatus } from './07-voice.mjs';
import { addTempVoiceTrigger, addWarningThresholdUI, deleteTempVoiceChannel, loadPrefixCommands, loadTempVoice, loadWarningThresholds, removeTempVoiceTrigger, removeWarningThresholdUI, savePrefixUI, saveRateLimits, saveTempVoiceConfig } from './08-temp-vc.mjs';
import { copyToClipboard, createReminderUI, deleteReminderUI, loadBanAppeals, loadBotActivity, loadCmdHeatmap, loadServerCompare, submitBanAppealUI, updateBanAppealStatusUI } from './09-activity.mjs';
import { createAnnouncementUI, createPollUI, loadGreetingsEditor, loadPollsAnnouncements } from './10-polls.mjs';

window.addDashUserUI = addDashUserUI;
window.alertSrvChanged = alertSrvChanged;
window.backSrv = backSrv;
window.backupNow = backupNow;
window.cancelGw = cancelGw;
window.clearBrandAsset = clearBrandAsset;
window.createGwUI = createGwUI;
window.delBackup = delBackup;
window.dlBackup = dlBackup;
window.endGw = endGw;
window.errClearLog = errClearLog;
window.errLoadMore = errLoadMore;
window.errSetFilter = errSetFilter;
window.errToggleStack = errToggleStack;
window.exportBotConfig = exportBotConfig;
window.exportConfig = exportConfig;
window.exportStats = exportStats;
window.filterCommands = filterCommands;
window.filterServers = filterServers;
window.loadAudit = loadAudit;
window.loadBackups = loadBackups;
window.loadDashUsers = loadDashUsers;
window.loadErrorAlert = loadErrorAlert;
window.loadErrors = loadErrors;
window.loadGiveaways = loadGiveaways;
window.loadServers = loadServers;
window.logout = logout;
window.populateGwServers = populateGwServers;
window.previewBg = previewBg;
window.previewBgBlur = previewBgBlur;
window.previewBorder = previewBorder;
window.previewColor = previewColor;
window.previewFont = previewFont;
window.previewRadius = previewRadius;
window.previewTitle = previewTitle;
window.removeDashUserUI = removeDashUserUI;
window.rerollGw = rerollGw;
window.saveErrorAlert = saveErrorAlert;
window.saveSettings = saveSettings;
window.saveUserScopes = saveUserScopes;
window.setLook = setLook;
window.showSrv = showSrv;
window.showToast = showToast;
window.togW = togW;
window.toggleBgType = toggleBgType;
window.toggleLogCat = toggleLogCat;
window.toggleMobileMenu = toggleMobileMenu;
window.toggleTheme = toggleTheme;
window.toggleUserScopes = toggleUserScopes;
window.updateBotAvatar = updateBotAvatar;
window.updateBotName = updateBotName;
window.updateBotPresence = updateBotPresence;
window.uploadBgFile = uploadBgFile;
window.uploadBrandAsset = uploadBrandAsset;
window.addTrackedChannel = addTrackedChannel;
window.clearTrackedChannels = clearTrackedChannels;
window.msgSearchFilterChange = msgSearchFilterChange;
window.onMsgSearchInput = onMsgSearchInput;
window.palRun = palRun;
window.removeTrackedChannel = removeTrackedChannel;
window.resetGreetingConfig = resetGreetingConfig;
window.saveAllLogSettings = saveAllLogSettings;
window.saveGreetingConfig = saveGreetingConfig;
window.saveSrvSettings = saveSrvSettings;
window.showSec = showSec;
window.showSrvTab = showSrvTab;
window.toggleGreeting = toggleGreeting;
window.updatePreview = updatePreview;
window.addSrvNote = addSrvNote;
window.banSrvMember = banSrvMember;
window.kickSrvMember = kickSrvMember;
window.loadInsights = loadInsights;
window.loadInvites = loadInvites;
window.loadMemberProfile = loadMemberProfile;
window.loadMod = loadMod;
window.loadMpServers = loadMpServers;
window.loadSrvNotes = loadSrvNotes;
window.searchMembers = searchMembers;
window.timeoutSrvMember = timeoutSrvMember;
window.toggleCompact = toggleCompact;
window.warnSrvMember = warnSrvMember;
window.addTicketType = addTicketType;
window.createTicketPanel = createTicketPanel;
window.deleteTicketType = deleteTicketType;
window.editQuestions = editQuestions;
window.editTicketTypeSettings = editTicketTypeSettings;
window.loadTickets = loadTickets;
window.previewTicketPanel = previewTicketPanel;
window.ticketSetLog = ticketSetLog;
window.ticketToggle = ticketToggle;
window.ticketToggleLeave = ticketToggleLeave;
window.tkClonePanel = tkClonePanel;
window.tkCloseModal = tkCloseModal;
window.tkDeletePanel = tkDeletePanel;
window.tkEditMessage = tkEditMessage;
window.tkEditPanel = tkEditPanel;
window.tkMarkUnsaved = tkMarkUnsaved;
window.tkPrevCreate = tkPrevCreate;
window.tkPrevPick = tkPrevPick;
window.tkRecFilterSet = tkRecFilterSet;
window.tkRenamePanel = tkRenamePanel;
window.tkResetChanges = tkResetChanges;
window.tkSaveChanges = tkSaveChanges;
window.tkSetCount = tkSetCount;
window.tkToggleFreq = tkToggleFreq;
window.tkToggleRoleChip = tkToggleRoleChip;
window.addAMFilter = addAMFilter;
window.bulkAMFilter = bulkAMFilter;
window.deleteAMFilter = deleteAMFilter;
window.exportAMConfig = exportAMConfig;
window.importAMConfig = importAMConfig;
window.loadAutomod = loadAutomod;
window.saveAMChannels = saveAMChannels;
window.saveAMRoles = saveAMRoles;
window.saveAMRule = saveAMRule;
window.toggleAMChanMode = toggleAMChanMode;
window.toggleAMChannel = toggleAMChannel;
window.toggleAMRole = toggleAMRole;
window.toggleAMRule = toggleAMRule;
window.uploadTxtFilter = uploadTxtFilter;
window.addRoleMenuOptionUI = addRoleMenuOptionUI;
window.createReactionRoleUI = createReactionRoleUI;
window.createRoleMenuUI = createRoleMenuUI;
window.deleteReactionRole = deleteReactionRole;
window.deleteRoleMenu = deleteRoleMenu;
window.editRoleMenuUI = editRoleMenuUI;
window.loadReactionRoles = loadReactionRoles;
window.loadRoleMenus = loadRoleMenus;
window.publishRoleMenuUI = publishRoleMenuUI;
window.removeRoleMenuOptionUI = removeRoleMenuOptionUI;
window.saveRoleMenuTitle = saveRoleMenuTitle;
window.createApiToken = createApiToken;
window.deleteApiToken = deleteApiToken;
window.deleteWebhook = deleteWebhook;
window.joinVoicePresence = joinVoicePresence;
window.joinVoicePresenceUI = joinVoicePresenceUI;
window.leaveVoicePresence = leaveVoicePresence;
window.loadVoicePresence = loadVoicePresence;
window.loadWebhooks = loadWebhooks;
window.moveVoicePresence = moveVoicePresence;
window.moveVoicePresenceUI = moveVoicePresenceUI;
window.setVoicePresenceStatus = setVoicePresenceStatus;
window.addTempVoiceTrigger = addTempVoiceTrigger;
window.addWarningThresholdUI = addWarningThresholdUI;
window.deleteTempVoiceChannel = deleteTempVoiceChannel;
window.loadPrefixCommands = loadPrefixCommands;
window.loadTempVoice = loadTempVoice;
window.loadWarningThresholds = loadWarningThresholds;
window.removeTempVoiceTrigger = removeTempVoiceTrigger;
window.removeWarningThresholdUI = removeWarningThresholdUI;
window.savePrefixUI = savePrefixUI;
window.saveRateLimits = saveRateLimits;
window.saveTempVoiceConfig = saveTempVoiceConfig;
window.copyToClipboard = copyToClipboard;
window.createReminderUI = createReminderUI;
window.deleteReminderUI = deleteReminderUI;
window.loadBanAppeals = loadBanAppeals;
window.loadBotActivity = loadBotActivity;
window.loadCmdHeatmap = loadCmdHeatmap;
window.loadServerCompare = loadServerCompare;
window.submitBanAppealUI = submitBanAppealUI;
window.updateBanAppealStatusUI = updateBanAppealStatusUI;
window.createAnnouncementUI = createAnnouncementUI;
window.createPollUI = createPollUI;
window.loadGreetingsEditor = loadGreetingsEditor;
window.loadPollsAnnouncements = loadPollsAnnouncements;

import { copyToken, toggleCollapsed } from './01-foundation.mjs';
window.copyToken = copyToken;
window.toggleCollapsed = toggleCollapsed;

// ──────────────────── Delegated event dispatch ────────────────────
// CSP forbids inline event handlers (no script-src 'unsafe-inline'), so every
// interactive element declares data-fn="windowFn" plus an optional JSON list
// data-args. Placeholders inside data-args are resolved at event time:
//   "@el"      → the element itself
//   "@value"   → el.value
//   "@checked" → el.checked
// data-fn values starting with "_" are sequencers: each array element of
// data-args is [fnName, ...args] and runs in order (multi-action buttons).
// data-fn="_hideSelf" hides the element (replaces onerror on broken images).
function resolveArg(v, el) {
    if (v === '@el') return el;
    if (v === '@value') return el.value;
    if (v === '@checked') return el.checked;
    if (Array.isArray(v)) return v.map((x) => resolveArg(x, el));
    return v;
}

function runNamed(fn, args, ev) {
    const f = window[fn];
    if (typeof f !== 'function') {
        console.warn('[dispatch] no window handler for data-fn="' + fn + '"');
        return;
    }
    try { f.apply(null, args); } catch (err) { console.error('[dispatch] ' + fn + ' failed:', err); }
    void ev;
}

function handleAction(el, ev) {
    const fn = el.getAttribute('data-fn');
    if (!fn) return;
    let args = [];
    const raw = el.getAttribute('data-args');
    if (raw) {
        try { args = JSON.parse(raw).map((v) => resolveArg(v, el)); }
        catch { args = []; }
    }
    if (fn === '_hideSelf') { el.style.display = 'none'; return; }
    if (fn.charAt(0) === '_') {
        for (const step of args) {
            if (Array.isArray(step) && step.length > 0) runNamed(String(step[0]), step.slice(1), ev);
        }
        return;
    }
    runNamed(fn, args, ev);
}

function findAction(target) {
    return target && target.closest ? target.closest('[data-fn]') : null;
}

document.addEventListener('click', (ev) => {
    const el = findAction(ev.target);
    if (el) handleAction(el, ev);
});
document.addEventListener('change', (ev) => {
    const el = findAction(ev.target);
    if (el) handleAction(el, ev);
});
document.addEventListener('input', (ev) => {
    const el = findAction(ev.target);
    if (el) handleAction(el, ev);
});
document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    const el = findAction(ev.target);
    if (el) handleAction(el, ev);
});
// 'error' does not bubble — capture phase still sees it on descendants.
document.addEventListener('error', (ev) => {
    const el = findAction(ev.target);
    if (el && el.getAttribute('data-fn') === '_hideSelf') el.style.display = 'none';
}, true);

// ──────────────────── data-fn helper registrations ────────────────────
// Small handlers referenced by data-fn attributes in generated markup but not
// exported as top-level section functions (they must exist on window for the
// delegated dispatcher).
import { amTxtUploadClick, srvEmbedSync } from './01-foundation.mjs';
import { grCoPick, grCoSet } from './02-ui-shell.mjs';
import { tkRemoveQuestion } from './04-tickets.mjs';
window.amTxtUploadClick = amTxtUploadClick;
window.srvEmbedSync = srvEmbedSync;
window.grCoPick = grCoPick;
window.grCoSet = grCoSet;
window.tkRemoveQuestion = tkRemoveQuestion;
