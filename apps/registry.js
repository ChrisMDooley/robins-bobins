/*
 * registry.js — every Robin's Bobins app, in one list.
 *
 * Adding an app = add its folder under apps/ and one entry here.
 * Which child SEES which app is decided per child (Parent Mode → "Apps").
 *
 *   id             stable, never rename (it is stored in coin/activity records)
 *   path           the app's start page, relative to the platform root
 *   storagePrefix  localStorage prefix the app uses for its own data (for backups)
 *   bridge         optional global with { sync(RB, childId), cardInfo(childId) } for apps
 *                  that keep their own ledger (Diktat did before the platform existed)
 */
(function (root) {
  'use strict';
  var R = root.RB.apps;

  R.register({
    id: 'diktat',
    title: 'Diktat Trainer',
    subject: 'Deutsch',
    icon: '🔊',
    color: '#1F6F8B',
    path: 'apps/diktat/index.html',
    storagePrefix: 'diktat-trainer:',
    bridge: 'RBDiktat'
  });

  // Sachunterricht: Bundesländer, Wappen, Nachbarländer, Hessen, Kartenkunde (for Alex, Klasse 4).
  R.register({
    id: 'geo',
    title: 'Deutschland & Hessen',
    subject: 'Sachunterricht',
    icon: '🗺️',
    color: '#3E8A5E',
    path: 'apps/geo/index.html',
    storagePrefix: 'rb-geo:',
    bridge: 'RBGeo',
    grantTo: ['alex']        // switched on for Alex once; Elternbereich can change it afterwards
  });

  // Starter for new apps. Hidden from children; open apps/_template/?child=lukas to try it.
  R.register({
    id: 'template',
    title: 'Neue App',
    subject: 'Vorlage',
    icon: '🧪',
    color: '#6E6472',
    path: 'apps/_template/index.html',
    storagePrefix: 'rb-template:',
    hidden: true
  });
})(typeof window !== 'undefined' ? window : globalThis);
