window.onload = function() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(85, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('space-map') });
    renderer.setSize(window.innerWidth, window.innerHeight);

    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.6);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xFFFFFF, 1);
    pointLight.position.set(-20, 0, 0);
    scene.add(pointLight);

    const textureLoader = new THREE.TextureLoader();
    const sunGeometry = new THREE.SphereGeometry(15, 32, 32); // sun scale

    // Load sun texture
    const sunMaterial = new THREE.MeshBasicMaterial({
        map: textureLoader.load('sun_texture.jpg') // sun texture
    });

    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.position.set(-20, 0, 0);
    scene.add(sun);

    let planets = [];
    let stars = [];
    let starLabels = [];
    let orbitLines = [];
    let planetsHidden = false; 
    let targetPlanet = null;
    let zooming = false;
    let orbitDistance = 30;
    let cameraAngle = 0;

    let moveLeft = false;
    let moveRight = false;
    let moveUp = false;
    let moveDown = false;

    const maxCameraHeight = 90;
    const minCameraHeight = -10;

    let isPlanetView = false;

    // Function to create specified stars for star map mode
    function createImportantStars() {
        const starNames = [
            "Sirius", "Canopus", "Arcturus", "Vega", "Betelgeuse", "Capella", 
            "Rigel", "Procyon", "Archernar", "Antares", "Aldebaran", 
            "Altair", "Spica", "Pollux", "Fomalhaut", "Deneb", 
            "Regulus", "Castor", "Bellatrix", "Alnilam"
        ];

        const starPositions = [
            { x: 500, y: 20, z: -100 }, { x: -700, y: 22, z: -300 }, 
            { x: 100, y: 21, z: -500 }, { x: -300, y: 23, z: -400 }, 
            { x: 600, y: 25, z: 100 }, { x: -200, y: 19, z: 300 },
            { x: 700, y: 20, z: 400 }, { x: -100, y: 18, z: 600 }, 
            { x: 400, y: 24, z: 200 }, { x: -500, y: 20, z: -100 }, 
            { x: 1000, y: 22, z: 300 }, { x: 800, y: 23, z: 500 },
            { x: -400, y: 19, z: -200 }, { x: -700, y: 21, z: 600 }, 
            { x: 900, y: 20, z: 100 }, { x: -300, y: 25, z: 500 }, 
            { x: 300, y: 18, z: 700 }, { x: -600, y: 20, z: -300 },
            { x: 200, y: 22, z: -200 }, { x: -400, y: 21, z: 300 }
        ];

        const starGeometry = new THREE.SphereGeometry(1, 24, 24);
        const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

        starNames.forEach((name, index) => {
            const star = new THREE.Mesh(starGeometry, starMaterial);
            const position = starPositions[index];
            star.position.set(position.x, position.y, position.z);
            stars.push(star);
            scene.add(star);

            // Create labels for the stars
            const label = document.createElement('div');
            label.className = 'label';
            label.textContent = name;
            label.style.position = 'absolute';
            label.style.color = '#ffffff';
            label.style.pointerEvents = 'none'; // Disable interaction
            document.body.appendChild(label);
            starLabels.push({ star, label });
        });
    }

    // Function to create 5000 stars for normal mode
    function createNormalStars() {
        const starGeometry = new THREE.SphereGeometry(0.25, 24, 24);
        const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

        for (let i = 0; i < 5000; i++) {
            const star = new THREE.Mesh(starGeometry, starMaterial);
            const [x, y, z] = Array(3).fill().map(() => THREE.MathUtils.randFloatSpread(2000));
            star.position.set(x, y, z);
            stars.push(star);
            scene.add(star);
        }
    }

    // Function to update star labels and prevent overlapping with UI
    function updateStarLabels() {
        starLabels.forEach(starLabel => {
            const vector = starLabel.star.position.clone().project(camera);
            const x = (vector.x + 1) * window.innerWidth / 2;
            const y = (-vector.y + 1) * window.innerHeight / 2;

            // Ensure labels don't overlap with the info panel
            const infoPanelWidth = 300; // Fixed width for the info panel
            if (x > window.innerWidth - infoPanelWidth) return;

            starLabel.label.style.left = `${x}px`;
            starLabel.label.style.top = `${y}px`;
        });
    }

    // Function to hide orbit lines in star map mode
    function hideOrbitLines() {
        orbitLines.forEach(line => scene.remove(line));
    }

    // Function to show orbit lines in normal mode
    function showOrbitLines() {
        orbitLines.forEach(line => scene.add(line));
    }

    // Toggle between star map and normal mode
    document.getElementById('open-star-map').addEventListener('click', function() {
        if (planetsHidden) {
            // Exit star map mode
            planets.forEach(planet => scene.add(planet.mesh)); // Add planets back to the scene
            planets.forEach(planet => scene.add(planet.hitBox)); // Add hitboxes back to the scene
            stars.forEach(star => scene.remove(star)); // Remove all stars
            starLabels.forEach(label => {
                // Only remove the label if it exists in the document
                if (document.body.contains(label.label)) {
                    document.body.removeChild(label.label); // Remove labels
                }
            });
            scene.add(sun); // Show sun
            showOrbitLines(); // Show orbit lines again
        } else {
            createImportantStars(); // Only show important stars in star map mode
            planets.forEach(planet => scene.remove(planet.mesh)); // Hide planets
            planets.forEach(planet => scene.remove(planet.hitBox)); // Hide hitboxes
            scene.remove(sun); // Hide sun in star map mode
            hideOrbitLines(); // Hide orbit lines in star map mode
        }
        planetsHidden = !planetsHidden; // Toggle the visibility state
    });

    // Fetch data and create planets
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            data.objects.forEach((planetData) => {
                const geometry = new THREE.SphereGeometry(planetData.radius / 10, 32, 32);
                const hitBoxGeometry = new THREE.SphereGeometry((planetData.radius / 10) * 3, 32, 32);

                let material;
                if (planetData.texture) {
                    material = new THREE.MeshStandardMaterial({
                        map: textureLoader.load(planetData.texture)
                    });
                } else {
                    material = new THREE.MeshStandardMaterial({ color: planetData.color || 0x888888 });
                }

                const planet = new THREE.Mesh(geometry, material);
                const hitBox = new THREE.Mesh(hitBoxGeometry, new THREE.MeshBasicMaterial({ visible: false }));

                const orbitRadius = (planetData.name === "Mercury" || planetData.name === "Venus" || planetData.name === "Earth" || planetData.name === "Mars") 
                    ? (planetData.realDistance / 4000000) * 2 // scale
                    : (planetData.realDistance / 4000000);

                planet.position.set(-orbitRadius - 20, 0, 0);
                hitBox.position.copy(planet.position);

                planets.push({ 
                    mesh: planet, 
                    hitBox, 
                    orbitRadius, 
                    speed: (2 * Math.PI) / (planetData.orbitalPeriod * 365 * 24 * 60 * 60) * 1000, // simulation speed
                    angle: 0, 
                    name: planetData.name, 
                    info: planetData.info || "No Information Available About This Planet" 
                });
                scene.add(planet);
                scene.add(hitBox);

                // Add orbit lines
                const orbitGeometry = new THREE.CircleGeometry(orbitRadius, 32);
                const orbitMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.2, transparent: true });
                const orbitLine = new THREE.LineLoop(orbitGeometry, orbitMaterial);
                orbitLine.rotation.x = Math.PI / 2;
                orbitLine.position.set(-20, 0, 0);
                orbitLines.push(orbitLine);
                scene.add(orbitLine);
            });
        })
        .catch(error => console.error('Error loading JSON:', error));

    camera.position.set(-20, 120, 0);
    camera.lookAt(-20, 0, 0);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    window.addEventListener('click', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(planets.map(p => p.hitBox));

        if (intersects.length > 0) {
            const hitBox = intersects[0].object;
            targetPlanet = planets.find(p => p.hitBox === hitBox);

            if (targetPlanet) {
                const infoPanel = document.getElementById('info-panel');
                infoPanel.innerHTML = `<h2>${targetPlanet.name}</h2><p>${targetPlanet.info}</p>`; 

                zooming = true;
                cameraAngle = 0;
                isPlanetView = true;
            } else {
                console.error("Target planet not found!");
            }
        }
    });
    

    // Prevent default actions on arrow keys
    window.addEventListener('keydown', function(event) {
        if (event.key.startsWith("Arrow")) {
            event.preventDefault();
        }
    });

    window.addEventListener('keydown', (event) => {
        switch (event.key) {
            case 'ArrowLeft':
                moveLeft = true;
                break;
            case 'ArrowRight':
                moveRight = true;
                break;
            case 'ArrowUp':
                moveUp = true;
                break;
            case 'ArrowDown':
                moveDown = true;
                break;
            case 'Escape':
                zooming = false;
                isPlanetView = false;
                camera.position.set(-20, 120, 0);
                camera.lookAt(-20, 0, 0);
                targetPlanet = null;
                break;
        }
    });

    window.addEventListener('keyup', (event) => {
        switch (event.key) {
            case 'ArrowLeft':
                moveLeft = false;
                break;
            case 'ArrowRight':
                moveRight = false;
                break;
            case 'ArrowUp':
                moveUp = false;
                break;
            case 'ArrowDown':
                moveDown = false;
                break;
        }
    });

    function animate() {
        requestAnimationFrame(animate);

        planets.forEach(planetObj => {
            planetObj.angle -= planetObj.speed;
            planetObj.mesh.position.x = -planetObj.orbitRadius * Math.cos(planetObj.angle) - 20;
            planetObj.mesh.position.z = planetObj.orbitRadius * Math.sin(planetObj.angle);
            planetObj.hitBox.position.copy(planetObj.mesh.position);
        });

        // Update star labels in every frame to ensure they are visible
        updateStarLabels();

        if (isPlanetView && zooming && targetPlanet) {
            const targetPosition = targetPlanet.mesh.position.clone().add(new THREE.Vector3(0, 10, 10));
            camera.position.lerp(targetPosition, 0.02);

            camera.lookAt(targetPlanet.mesh.position);

            if (camera.position.distanceTo(targetPosition) < 0.1) {
                zooming = false;
            }

            cameraAngle += 0.002;
            camera.position.x = targetPlanet.mesh.position.x + orbitDistance * Math.cos(cameraAngle);
            camera.position.z = targetPlanet.mesh.position.z + orbitDistance * Math.sin(cameraAngle);
            camera.position.y = Math.max(minCameraHeight, Math.min(maxCameraHeight, camera.position.y + (moveUp ? 1 : 0) - (moveDown ? 1 : 0)));
        } else {
            if (!isPlanetView) {
                if (moveLeft) camera.position.x -= 1;
                if (moveRight) camera.position.x += 1;
                if (moveUp) camera.position.z -= 1;
                if (moveDown) camera.position.z += 1;
            }
        }

        renderer.render(scene, camera);
    }

    // Create normal stars when loading
    createNormalStars();

    animate();
};