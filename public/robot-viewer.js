'use strict';
// Three.js-based URDF viewer for the InMoov head.
// Requires three.min.js, STLLoader.js, and OrbitControls.js to be loaded first.
(function () {
  var COLORS = {
    frame:  { color: 0xb8c8d8, specular: 0x445566, shininess: 40  },
    cover:  { color: 0xddeef8, specular: 0x334455, shininess: 30  },
    eye:    { color: 0xf8f8ff, specular: 0xaaaacc, shininess: 90  },
    iris:   { color: 0x2244bb, specular: 0x6688ff, shininess: 130 },
    camera: { color: 0x111118, specular: 0x222233, shininess: 60  },
  };

  function materialFor(linkName) {
    var T = window.THREE;
    var c;
    if (linkName.indexOf('iris')   !== -1) c = COLORS.iris;
    else if (linkName.indexOf('camera') !== -1) c = COLORS.camera;
    else if (linkName.indexOf('eye')    !== -1 && linkName.indexOf('support') === -1) c = COLORS.eye;
    else if (linkName === 'jaw_link' || linkName === 'skull_link' ||
             linkName === 'face_link' || linkName.indexOf('ear') !== -1) c = COLORS.cover;
    else c = COLORS.frame;
    return new T.MeshPhongMaterial({ color: c.color, specular: c.specular, shininess: c.shininess });
  }

  function parseVec3(str) {
    return (str || '0 0 0').trim().split(/\s+/).map(Number);
  }

  function loadSTL(url, material) {
    return new Promise(function (resolve) {
      var loader = new window.THREE.STLLoader();
      loader.load(url, function (geo) {
        geo.computeVertexNormals();
        resolve(new window.THREE.Mesh(geo, material));
      }, undefined, function (err) {
        console.warn('[RobotViewer] STL load failed:', url, err);
        resolve(null);
      });
    });
  }

  function RobotViewer(canvas) {
    this._canvas   = canvas;
    this._renderer = null;
    this._scene    = null;
    this._camera   = null;
    this._controls = null;
    this._joints   = {};
    this._raf      = null;
  }

  RobotViewer.prototype.init = function () {
    var self   = this;
    var THREE  = window.THREE;
    var canvas = this._canvas;

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    this._renderer = renderer;

    var scene = new THREE.Scene();
    this._scene = scene;

    var camera = new THREE.PerspectiveCamera(38, 1, 0.001, 5);
    this._camera = camera;

    // Ambient + two directional lights for good depth cues
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    var d1 = new THREE.DirectionalLight(0xffffff, 0.85);
    d1.position.set(2, 3, 4);
    scene.add(d1);
    var d2 = new THREE.DirectionalLight(0x99aaff, 0.3);
    d2.position.set(-2, -1, -1);
    scene.add(d2);

    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping  = true;
    controls.dampingFactor  = 0.1;
    controls.minDistance    = 0.05;
    controls.maxDistance    = 1.2;
    this._controls = controls;

    // Resize handling
    function resize() {
      var parent = canvas.parentElement;
      if (!parent) return;
      var w = parent.clientWidth;
      var h = parent.clientHeight;
      if (w < 1 || h < 1) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    this._resize = resize;
    resize();
    var ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    return this._loadURDF('/robot/head.urdf').then(function () {
      // Position camera: InMoov head faces +X in URDF / Three.js space after root rotation.
      // Camera at +X side so we look at the face head-on.
      camera.position.set(0.42, 0.08, 0.05);
      controls.target.set(0.04, 0.06, 0);
      controls.update();
      self._loop();
      return self;
    });
  };

  RobotViewer.prototype._loadURDF = function (url) {
    var self  = this;
    var THREE = window.THREE;

    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (text) {
      var doc    = new DOMParser().parseFromString(text, 'text/xml');
      var links  = {};
      var joints = {};

      // 1. Build link groups + queue STL loads
      var loads = [];
      var linkEls = doc.querySelectorAll('link');
      for (var i = 0; i < linkEls.length; i++) {
        (function (linkEl) {
          var name  = linkEl.getAttribute('name');
          var group = new THREE.Group();
          group.name = 'link:' + name;
          links[name] = group;

          var meshEl = linkEl.querySelector('visual geometry mesh');
          if (!meshEl) return;

          var filename = meshEl.getAttribute('filename');
          var scaleArr = parseVec3(meshEl.getAttribute('scale') || '1 1 1');
          var mat      = materialFor(name);

          loads.push(loadSTL(filename, mat).then(function (mesh) {
            if (!mesh) return;
            mesh.scale.set(scaleArr[0], scaleArr[1], scaleArr[2]);
            var originEl = linkEl.querySelector('visual origin');
            if (originEl) {
              var xyz = parseVec3(originEl.getAttribute('xyz'));
              var rpy = parseVec3(originEl.getAttribute('rpy'));
              mesh.position.set(xyz[0], xyz[1], xyz[2]);
              mesh.rotation.set(rpy[0], rpy[1], rpy[2]);
            }
            group.add(mesh);
          }));
        })(linkEls[i]);
      }

      return Promise.all(loads).then(function () {
        // 2. Wire up joint hierarchy
        var childLinks = {};
        var jointEls   = doc.querySelectorAll('joint');

        for (var j = 0; j < jointEls.length; j++) {
          var jointEl    = jointEls[j];
          var jname      = jointEl.getAttribute('name');
          var jtype      = jointEl.getAttribute('type');
          var parentName = jointEl.querySelector('parent').getAttribute('link');
          var childName  = jointEl.querySelector('child').getAttribute('link');

          var originEl   = jointEl.querySelector('origin');
          var xyz        = parseVec3(originEl ? originEl.getAttribute('xyz') : null);
          var rpy        = parseVec3(originEl ? originEl.getAttribute('rpy') : null);

          var axisEl     = jointEl.querySelector('axis');
          var axisArr    = parseVec3(axisEl ? axisEl.getAttribute('xyz') : '0 0 1');
          var axisVec    = new THREE.Vector3(axisArr[0], axisArr[1], axisArr[2]).normalize();

          var limitEl    = jointEl.querySelector('limit');
          var lower      = limitEl ? parseFloat(limitEl.getAttribute('lower') || '-3.14') : -3.14;
          var upper      = limitEl ? parseFloat(limitEl.getAttribute('upper') ||  '3.14') :  3.14;

          // origin group = joint's position + rpy offset (fixed)
          var originGroup = new THREE.Group();
          originGroup.name = 'jOrig:' + jname;
          originGroup.position.set(xyz[0], xyz[1], xyz[2]);
          originGroup.rotation.set(rpy[0], rpy[1], rpy[2]);

          // pivot group = rotates for joint angle
          var pivotGroup = new THREE.Group();
          pivotGroup.name = 'jPivot:' + jname;
          originGroup.add(pivotGroup);

          var childLink = links[childName];
          if (childLink) pivotGroup.add(childLink);

          var parentLink = links[parentName];
          if (parentLink) parentLink.add(originGroup);

          childLinks[childName] = true;

          if (jtype !== 'fixed') {
            joints[jname] = { pivot: pivotGroup, axis: axisVec, lower: lower, upper: upper };
          }
        }

        // 3. Find root link and attach to scene
        var rootGroup = new THREE.Group();
        // Convert URDF Z-up to Three.js Y-up
        rootGroup.rotation.x = -Math.PI / 2;

        var linkNames = Object.keys(links);
        for (var k = 0; k < linkNames.length; k++) {
          if (!childLinks[linkNames[k]]) {
            rootGroup.add(links[linkNames[k]]);
            break;
          }
        }
        self._scene.add(rootGroup);
        self._joints = joints;
      });
    }).catch(function (e) {
      console.error('[RobotViewer] Failed to load URDF:', e);
    });
  };

  RobotViewer.prototype.setJoint = function (name, angle) {
    var j = this._joints[name];
    if (!j) return;
    var clamped = Math.max(j.lower, Math.min(j.upper, angle));
    j.pivot.quaternion.setFromAxisAngle(j.axis, clamped);
  };

  RobotViewer.prototype._loop = function () {
    var self = this;
    this._raf = requestAnimationFrame(function () { self._loop(); });
    this._controls.update();
    this._renderer.render(this._scene, this._camera);
  };

  RobotViewer.prototype.dispose = function () {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._renderer) this._renderer.dispose();
  };

  window.RobotViewer = RobotViewer;
})();
