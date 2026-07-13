const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { initializeApp }     = require('firebase-admin/app');
const { getFirestore }      = require('firebase-admin/firestore');
const { getMessaging }      = require('firebase-admin/messaging');

initializeApp();

// Format NGN amount e.g. ₦12,500.00
function fmt(amount) {
  return '₦' + Number(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 });
}

/**
 * notifyPOSOnTabReady
 * Fires when a tab document is updated. If status flips to 'awaiting-pos',
 * sends a push notification to every registered POS device (fcmTokens collection).
 */
exports.notifyPOSOnTabReady = onDocumentUpdated('tabs/{tabId}', async event => {
  const before = event.data.before.data();
  const after  = event.data.after.data();

  // Only act when status changes TO 'awaiting-pos'
  if (before.status === after.status) return null;
  if (after.status !== 'awaiting-pos') return null;

  const db = getFirestore();
  const tokensSnap = await db.collection('fcmTokens').get();
  const tokens = tokensSnap.docs.map(d => d.id).filter(Boolean);

  if (!tokens.length) return null;

  const serverName = after.servingStaff?.name || after.openedBy?.name || 'Staff';
  const message = {
    notification: {
      title: '📋 Tab Ready for Payment',
      body:  `${after.customerName} · ${after.tableLabel} · ${fmt(after.subtotal)} · Served by ${serverName}`,
    },
    webpush: {
      notification: {
        icon:               'https://eden54group.com/logo/eden%2054%20logo.jpeg',
        badge:              'https://eden54group.com/logo/eden%2054%20logo.jpeg',
        requireInteraction: true,
        tag:                'eden54-tab',
      },
      fcmOptions: {
        link: 'https://eden54group.com/portal/pos/',
      },
    },
    tokens,
  };

  const response = await getMessaging().sendEachForMulticast(message);

  // Remove tokens that are no longer valid (device uninstalled app, etc.)
  const stale = response.responses
    .map((r, i) => (!r.success ? tokens[i] : null))
    .filter(Boolean);

  if (stale.length) {
    await Promise.all(stale.map(t => db.collection('fcmTokens').doc(t).delete()));
  }

  return null;
});
