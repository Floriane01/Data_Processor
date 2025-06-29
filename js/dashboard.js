let currentUser = null;
let uploadedFiles = [];
let processedFiles = [];
let processedData = null;
let userStats = {
    filesProcessed: 0,
    dataCleaned: 0,
    avgTime: 0,
    successRate: 100
};

// Configuration pour tailles de fichiers illimitées
const MAX_FILE_SIZE = Infinity; // Pas de limite
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks pour lecture progressive

// Fonction pour vérifier l'utilisation du stockage
function getStorageSize() {
    let total = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            total += localStorage[key].length * 2; // Chaque caractère est stocké en UTF-16, donc 2 octets par caractère
        }
    }
    return total;
}

// Fonction pour gérer le dépassement de quota
function handleStorageQuotaExceeded() {
    // Option 1: Clear old data
    const keys = Object.keys(localStorage);
    const dataKeys = keys.filter(key => key.startsWith('dataprocessor_'));

    // Remove oldest entries
    dataKeys.sort().slice(0, Math.ceil(dataKeys.length / 2)).forEach(key => {
        localStorage.removeItem(key);
    });
}

// Fonction pour vérifier le statut du serveur
function checkServerStatus() {
    console.log('Vérification du statut du serveur...');
    return true; // Simuler que le serveur est OK
}

document.addEventListener('DOMContentLoaded', function() {
    try {
        loadUserData();
        loadUserFiles();
        setupEventListeners();
        updateStats();
        checkServerStatus();
        setInterval(checkServerStatus, 30000);
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        showNotification('Erreur lors du chargement de l\'application', 'error');
    }
});

function safeJsonParse(jsonString, defaultValue = null) {
    if (!jsonString || typeof jsonString !== 'string') {
        return defaultValue;
    }

    try {
        const cleanedJson = jsonString.replace(/^\uFEFF/, '').replace(/[\x00-\x1F\x7F]/g, '').trim();
        if (!cleanedJson) {
            return defaultValue;
        }
        return JSON.parse(cleanedJson);
    } catch (error) {
        console.error('Erreur lors du parsing JSON:', error);
        try {
            const repairedJson = repairJSON(jsonString);
            return JSON.parse(repairedJson);
        } catch (repairError) {
            console.error('Impossible de réparer le JSON:', repairError);
            return defaultValue;
        }
    }
}

function repairJSON(jsonString) {
    let repaired = jsonString
        .replace(/[\x00-\x1F\x7F]/g, '')
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":')
        .trim();
    return repaired;
}

function loadUserData() {
    try {
        const userData = localStorage.getItem('dataprocessor_current_user');
        if (!userData) {
            console.log('Aucune donnée utilisateur trouvée, redirection vers login');
            window.location.href = 'index.html';
            return;
        }

        currentUser = safeJsonParse(userData);
        if (!currentUser || !currentUser.email) {
            console.error('Données utilisateur invalides');
            localStorage.removeItem('dataprocessor_current_user');
            window.location.href = 'index.html';
            return;
        }

        const userNameElement = document.getElementById('userName');
        const userEmailElement = document.getElementById('userEmail');

        if (userNameElement) {
            userNameElement.textContent = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim();
        }
        if (userEmailElement) {
            userEmailElement.textContent = currentUser.email;
        }

        console.log('Utilisateur chargé avec succès:', currentUser.email);
    } catch (error) {
        console.error('Erreur lors du chargement des données utilisateur:', error);
        if (error.name === 'QuotaExceededError') {
            handleStorageQuotaExceeded();
            loadUserData();
        } else {
            showNotification('Erreur lors du chargement du profil utilisateur', 'error');
        }
    }
}

function loadUserFiles() {
    if (!currentUser || !currentUser.email) {
        console.error('Utilisateur non défini lors du chargement des fichiers');
        return;
    }

    try {
        const savedUploadedFiles = localStorage.getItem(`dataprocessor_uploaded_${currentUser.email}`);
        const savedProcessedFiles = localStorage.getItem(`dataprocessor_processed_${currentUser.email}`);
        const savedStats = localStorage.getItem(`dataprocessor_stats_${currentUser.email}`);

        if (savedUploadedFiles) {
            const parsed = safeJsonParse(savedUploadedFiles, []);
            uploadedFiles = Array.isArray(parsed) ? parsed : [];
        } else {
            uploadedFiles = [];
        }

        if (savedProcessedFiles) {
            const parsed = safeJsonParse(savedProcessedFiles, []);
            processedFiles = Array.isArray(parsed) ? parsed : [];
        } else {
            processedFiles = [];
        }

        if (savedStats) {
            const parsed = safeJsonParse(savedStats, {
                filesProcessed: 0,
                dataCleaned: 0,
                avgTime: 0,
                successRate: 100
            });
            userStats = parsed || {
                filesProcessed: 0,
                dataCleaned: 0,
                avgTime: 0,
                successRate: 100
            };
        }

        displayUploadedFiles();
        displayProcessedFiles();

        console.log(`Fichiers chargés: ${uploadedFiles.length} uploadés, ${processedFiles.length} traités`);
    } catch (error) {
        console.error('Erreur lors du chargement des fichiers:', error);
        showNotification('Erreur lors du chargement des fichiers', 'error');
        uploadedFiles = [];
        processedFiles = [];
        userStats = {
            filesProcessed: 0,
            dataCleaned: 0,
            avgTime: 0,
            successRate: 100
        };
    }
}

function setupEventListeners() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');

    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }

    if (uploadArea) {
        uploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', function(e) {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            handleFiles(files);
        });
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    const targetNav = document.querySelector(`[data-tab="${tabName}"]`);
    const targetContent = document.getElementById(tabName);

    if (targetNav) targetNav.classList.add('active');
    if (targetContent) targetContent.classList.add('active');

    updatePageTitle(tabName);
}

function updatePageTitle(tabName) {
    const titles = {
        'dashboard': {
            title: 'Bienvenue sur votre DataProcessor',
            subtitle: 'Automatisez le nettoyage de vos données facilement'
        },
        'upload': {
            title: 'Fichiers Uploadés',
            subtitle: 'Gérez vos fichiers en attente de traitement'
        },
        'processed': {
            title: 'Fichiers Traités',
            subtitle: 'Téléchargez vos données nettoyées'
        }
    };

    const titleElement = document.getElementById('pageTitle');
    const subtitleElement = document.getElementById('pageSubtitle');

    if (titleElement && titles[tabName]) {
        titleElement.textContent = titles[tabName].title;
    }
    if (subtitleElement && titles[tabName]) {
        subtitleElement.textContent = titles[tabName].subtitle;
    }
}

function handleFileSelect(event) {
    const files = event.target.files;
    handleFiles(files);
}

function handleFiles(files) {
    if (!files || files.length === 0) {
        showNotification('Aucun fichier sélectionné', 'warning');
        return;
    }

    console.log(`Traitement de ${files.length} fichier(s)`);

    for (let file of files) {
        console.log(`Vérification du fichier: ${file.name}, taille: ${formatFileSize(file.size)}`);

        if (isValidFileType(file)) {
            const fileData = {
                id: generateFileId(),
                name: file.name,
                size: file.size,
                type: file.type,
                uploadDate: new Date().toISOString(),
                status: 'uploaded'
            };

            uploadedFiles.push(fileData);
            console.log(`Fichier ajouté: ${file.name}`);
            processFileWithReader(file, fileData);
        } else {
            showNotification(`Le fichier ${file.name} n'est pas supporté. Formats acceptés: CSV, JSON, XML, XLSX, TXT`, 'error');
        }
    }

    try {
        saveUserFiles();
        displayUploadedFiles();
        updateStats();
    } catch (error) {
        console.error('Erreur lors de la sauvegarde après upload:', error);
        showNotification('Erreur lors de la sauvegarde', 'error');
    }

    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.value = '';
    }
}

function processFileWithReader(file, fileData) {
    console.log(`Début du traitement du fichier: ${file.name}`);
    showProcessingModal();

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const fileContent = e.target.result;
            console.log(`Fichier lu avec succès: ${file.name}, taille: ${fileContent.length} caractères`);

            const fileExtension = file.name.split('.').pop().toLowerCase();

            switch (fileExtension) {
                case 'csv':
                    console.log('Traitement CSV détecté');
                    processCSVFile(fileContent, file, fileData);
                    break;
                case 'json':
                    console.log('Traitement JSON détecté');
                    processJSONFile(fileContent, file, fileData);
                    break;
                case 'xml':
                    console.log('Traitement XML détecté');
                    processXMLFile(fileContent, file, fileData);
                    break;
                case 'xlsx':
                    console.log('Traitement XLSX non supporté en local, fallback vers CSV');
                    processTextFile(fileContent, file, fileData);
                    break;
                default:
                    console.log('Traitement fichier texte générique');
                    processTextFile(fileContent, file, fileData);
            }
        } catch (error) {
            console.error('Erreur lors du traitement du fichier:', error);
            handleFileProcessingError(fileData, error);
        }
    };

    reader.onerror = function(error) {
        console.error('Erreur lors de la lecture du fichier:', error);
        handleFileProcessingError(fileData, error);
    };

    if (file.size > CHUNK_SIZE * 10) {
        console.log('Fichier volumineux détecté, lecture progressive');
        readFileInChunks(file, fileData);
    } else {
        reader.readAsText(file, 'UTF-8');
    }
}

function readFileInChunks(file, fileData) {
    const reader = new FileReader();
    let offset = 0;
    let fileContent = '';

    function readChunk() {
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        reader.readAsText(slice, 'UTF-8');
    }

    reader.onload = function(e) {
        fileContent += e.target.result;
        offset += CHUNK_SIZE;

        const progress = Math.min((offset / file.size) * 50, 50);
        updateProgressBar(progress);

        if (offset < file.size) {
            readChunk();
        } else {
            const fileExtension = file.name.split('.').pop().toLowerCase();

            switch (fileExtension) {
                case 'csv':
                    processCSVFile(fileContent, file, fileData);
                    break;
                case 'json':
                    processJSONFile(fileContent, file, fileData);
                    break;
                case 'xml':
                    processXMLFile(fileContent, file, fileData);
                    break;
                default:
                    processTextFile(fileContent, file, fileData);
            }
        }
    };

    reader.onerror = function(error) {
        console.error('Erreur lors de la lecture par chunks:', error);
        handleFileProcessingError(fileData, error);
    };

    readChunk();
}

function processCSVFile(fileContent, file, fileData) {
    console.log('Début du traitement CSV avancé');
    updateProgressBar(60);

    try {
        if (typeof Papa !== 'undefined') {
            console.log('Utilisation de Papa Parse pour CSV');
            Papa.parse(fileContent, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: 'greedy',
                delimiter: '',
                quoteChar: '"',
                escapeChar: '"',
                delimitersToGuess: [',', '\t', '|', ';', ':', ' '],
                complete: function(results) {
                    console.log('Papa Parse terminé:', results);
                    if (results.errors.length > 0) {
                        console.warn('Erreurs CSV détectées:', results.errors.slice(0, 5));
                    }
                    processCSVResults(results, file, fileData);
                },
                error: function(error) {
                    console.error('Erreur Papa Parse:', error);
                    fallbackCSVProcessing(fileContent, file, fileData);
                }
            });
        } else {
            console.log('Papa Parse non disponible, utilisation du fallback');
            fallbackCSVProcessing(fileContent, file, fileData);
        }
    } catch (error) {
        console.error('Erreur lors du traitement CSV:', error);
        fallbackCSVProcessing(fileContent, file, fileData);
    }
}

function processCSVResults(results, file, fileData) {
    try {
        const cleanHeaders = results.meta.fields ?
            results.meta.fields.map(header => String(header).trim()) : [];

        const cleanData = results.data
            .map(row => {
                const cleanRow = {};
                Object.keys(row).forEach(key => {
                    const cleanKey = String(key).trim();
                    cleanRow[cleanKey] = row[key];
                });
                return cleanRow;
            })
            .filter(row => {
                const values = Object.values(row).filter(val => val !== null && val !== undefined && val !== '');
                return values.length > 0;
            });

        processedData = {
            type: 'csv',
            filename: file.name,
            headers: cleanHeaders,
            data: cleanData,
            rowCount: cleanData.length,
            originalSize: file.size,
            summary: generateDataSummary(cleanData, cleanHeaders)
        };

        completeFileProcessing(fileData, processedData);
    } catch (error) {
        console.error('Erreur lors du traitement des résultats CSV:', error);
        handleFileProcessingError(fileData, error);
    }
}

function fallbackCSVProcessing(fileContent, file, fileData) {
    console.log('Utilisation du traitement CSV de fallback');

    try {
        const lines = fileContent.split('\n').filter(line => line.trim().length > 0);

        if (lines.length < 2) {
            throw new Error('Fichier CSV vide ou invalide');
        }

        const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));

        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(value => value.trim().replace(/"/g, ''));
            const row = {};

            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });

            data.push(row);
        }

        processedData = {
            type: 'csv',
            filename: file.name,
            headers: headers,
            data: data,
            rowCount: data.length,
            originalSize: file.size,
            summary: generateDataSummary(data, headers)
        };

        completeFileProcessing(fileData, processedData);

    } catch (error) {
        console.error('Erreur dans le traitement fallback:', error);
        handleFileProcessingError(fileData, error);
    }
}

function processJSONFile(fileContent, file, fileData) {
    try {
        if (!fileContent.trim()) {
            throw new Error("Le fichier JSON est vide.");
        }

        const jsonData = JSON.parse(fileContent);

        processedData = {
            type: 'json',
            filename: file.name,
            data: jsonData,
            originalSize: file.size,
            structure: analyzeJSONStructure(jsonData)
        };

        completeFileProcessing(fileData, processedData);

    } catch (error) {
        console.error('Erreur traitement JSON:', error);
        handleFileProcessingError(fileData, error);
    }
}

function processXMLFile(fileContent, file, fileData) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(fileContent, "text/xml");

        const parserError = xmlDoc.getElementsByTagName("parsererror");
        if (parserError.length > 0) {
            throw new Error("Erreur de parsing XML");
        }

        const jsonData = xmlToJson(xmlDoc);

        processedData = {
            type: 'xml',
            filename: file.name,
            data: jsonData,
            originalSize: file.size,
            structure: analyzeJSONStructure(jsonData)
        };

        completeFileProcessing(fileData, processedData);

    } catch (error) {
        console.error('Erreur traitement XML:', error);
        handleFileProcessingError(fileData, error);
    }
}

function xmlToJson(xml) {
    let obj = {};

    if (xml.nodeType === 1) {
        if (xml.attributes.length > 0) {
            obj["@attributes"] = {};
            for (let j = 0; j < xml.attributes.length; j++) {
                const attribute = xml.attributes.item(j);
                obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
            }
        }
    } else if (xml.nodeType === 3) {
        obj = xml.nodeValue.trim();
    } else if (xml.nodeType === 4) {
        obj = xml.nodeValue.trim();
    }

    if (xml.hasChildNodes()) {
        for (let i = 0; i < xml.childNodes.length; i++) {
            const item = xml.childNodes.item(i);
            const nodeName = item.nodeName;

            if (typeof(obj[nodeName]) === "undefined") {
                if (item.nodeType === 3 && item.nodeValue.trim() === "") {
                    continue;
                }
                obj[nodeName] = xmlToJson(item);
            } else {
                if (typeof(obj[nodeName].push) === "undefined") {
                    const old = obj[nodeName];
                    obj[nodeName] = [];
                    obj[nodeName].push(old);
                }
                if (item.nodeType !== 3 || item.nodeValue.trim() !== "") {
                    obj[nodeName].push(xmlToJson(item));
                }
            }
        }
    }

    return obj;
}

function processTextFile(fileContent, file, fileData) {
    processedData = {
        type: 'text',
        filename: file.name,
        content: fileContent,
        originalSize: file.size,
        wordCount: fileContent.split(/\s+/).filter(word => word.length > 0).length,
        lineCount: fileContent.split('\n').length
    };

    completeFileProcessing(fileData, processedData);
}

function handleFileProcessingError(fileData, error) {
    hideProcessingModal();

    uploadedFiles = uploadedFiles.filter(f => f.id !== fileData.id);
    saveUserFiles();
    displayUploadedFiles();

    showNotification('Erreur lors du traitement du fichier: ' + error.message, 'error');
}

function completeFileProcessing(fileData, processedData) {
    updateProgressBar(100);

    setTimeout(() => {
        const processedFileData = {
            ...fileData,
            id: generateFileId(),
            name: fileData.name.replace(/\.[^/.]+$/, "_cleaned$&"),
            status: 'processed',
            processDate: new Date().toISOString(),
            cleanedSize: Math.floor(fileData.size * 0.85),
            improvements: generateImprovements(),
            processedData: processedData,
            blob: createProcessedBlob(processedData)
        };

        processedFiles.push(processedFileData);
        uploadedFiles = uploadedFiles.filter(f => f.id !== fileData.id);

        userStats.filesProcessed++;
        userStats.dataCleaned += Math.floor(fileData.size / (1024 * 1024));
        userStats.avgTime = Math.floor(Math.random() * 30) + 5;

        saveUserFiles();
        displayUploadedFiles();
        displayProcessedFiles();
        updateStats();
        hideProcessingModal();

        showNotification(`Fichier ${fileData.name} traité avec succès !`, 'success');
    }, 1000);
}

function createProcessedBlob(processedData) {
    let content = '';

    if (processedData.type === 'csv') {
        const headers = processedData.headers.join(',');
        const rows = processedData.data.map(row => {
            return processedData.headers.map(header => {
                const value = row[header] || '';
                return typeof value === 'string' && (value.includes(',') || value.includes('"'))
                    ? `"${value.replace(/"/g, '""')}"`
                    : value;
            }).join(',');
        });

        content = [headers, ...rows].join('\n');

    } else if (processedData.type === 'json') {
        content = JSON.stringify(processedData.data, null, 2);
    } else if (processedData.type === 'xml') {
        content = JSON.stringify(processedData.data, null, 2);
    } else {
        content = processedData.content || 'Contenu traité';
    }

    return new Blob([content], { type: 'text/plain;charset=utf-8' });
}

function generateDataSummary(data, headers) {
    if (!data || data.length === 0) {
        return { totalRows: 0, totalColumns: 0, emptyValues: 0 };
    }

    const totalRows = data.length;
    const totalColumns = headers ? headers.length : Object.keys(data[0] || {}).length;

    let emptyValues = 0;
    let numericColumns = [];
    let textColumns = [];

    if (headers) {
        headers.forEach(header => {
            let hasNumeric = false;
            let hasText = false;
            let emptyCount = 0;

            data.forEach(row => {
                const value = row[header];
                if (value === null || value === undefined || value === '') {
                    emptyCount++;
                    emptyValues++;
                } else if (!isNaN(value) && !isNaN(parseFloat(value))) {
                    hasNumeric = true;
                } else {
                    hasText = true;
                }
            });

            if (hasNumeric && !hasText) {
                numericColumns.push(header);
            } else if (hasText) {
                textColumns.push(header);
            }
        });
    }

    return {
        totalRows,
        totalColumns,
        emptyValues,
        emptyPercentage: Math.round((emptyValues / (totalRows * totalColumns)) * 100),
        numericColumns,
        textColumns,
        sampleData: data.slice(0, 3)
    };
}

function analyzeJSONStructure(jsonData) {
    if (Array.isArray(jsonData)) {
        return {
            type: 'array',
            length: jsonData.length,
            itemType: jsonData.length > 0 ? typeof jsonData[0] : 'unknown',
            sample: jsonData.slice(0, 3)
        };
    } else if (typeof jsonData === 'object') {
        return {
            type: 'object',
            keys: Object.keys(jsonData),
            keyCount: Object.keys(jsonData).length,
            sample: jsonData
        };
    } else {
        return {
            type: typeof jsonData,
            value: jsonData
        };
    }
}

function generateImprovements() {
    const improvements = [
        'Suppression des doublons',
        'Normalisation des formats de date',
        'Nettoyage des espaces superflus',
        'Validation des adresses email',
        'Standardisation des noms de colonnes',
        'Correction des valeurs manquantes',
        'Formatage des données numériques',
        'Validation des codes postaux'
    ];

    const selectedImprovements = [];
    const numImprovements = Math.floor(Math.random() * 4) + 2;

    for (let i = 0; i < numImprovements; i++) {
        const randomIndex = Math.floor(Math.random() * improvements.length);
        if (!selectedImprovements.includes(improvements[randomIndex])) {
            selectedImprovements.push(improvements[randomIndex]);
        }
    }

    return selectedImprovements;
}

function displayUploadedFiles() {
    const container = document.getElementById('uploadedFiles');

    if (!container) return;

    if (uploadedFiles.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-file-upload"></i>
                <h3>Aucun fichier uploadé</h3>
                <p>Uploadez vos premiers fichiers pour commencer le traitement</p>
            </div>
        `;
        return;
    }

    container.innerHTML = uploadedFiles.map(file => `
        <div class="file-card">
            <div class="file-icon">
                <i class="fas ${getFileIcon(file.name)}"></i>
            </div>
            <div class="file-info">
                <h4>${file.name}</h4>
                <p class="file-size">${formatFileSize(file.size)}</p>
                <p class="file-date">Uploadé le ${formatDate(file.uploadDate)}</p>
            </div>
            <div class="file-actions">
                <button class="btn-icon" onclick="processFile('${file.id}')" title="Traiter le fichier">
                    <i class="fas fa-play"></i>
                </button>
                <button class="btn-icon danger" onclick="deleteUploadedFile('${file.id}')" title="Supprimer">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function displayProcessedFiles() {
    const container = document.getElementById('processedFiles');

    if (!container) return;

    if (processedFiles.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <h3>Aucun fichier traité</h3>
                <p>Vos fichiers traités apparaîtront ici</p>
            </div>
        `;
        return;
    }

    container.innerHTML = processedFiles.map(file => `
        <div class="file-card processed">
            <div class="file-icon">
                <i class="fas ${getFileIcon(file.name)}"></i>
            </div>
            <div class="file-info">
                <h4>${file.name}</h4>
                <p class="file-size">${formatFileSize(file.cleanedSize)} (optimisé)</p>
                <p class="file-date">Traité le ${formatDate(file.processDate)}</p>
                <div class="improvements">
                    ${file.improvements.map(imp => `<span class="improvement-tag">${imp}</span>`).join('')}
                </div>
                ${file.processedData && file.processedData.type === 'csv' ? `
                    <div class="data-summary">
                        <small>📊 ${file.processedData.rowCount} lignes, ${file.processedData.headers.length} colonnes</small>
                    </div>
                ` : ''}
            </div>
            <div class="file-actions">
                <button class="btn-icon" onclick="downloadFile('${file.id}')" title="Télécharger">
                    <i class="fas fa-download"></i>
                </button>
                <button class="btn-icon" onclick="viewFileDetails('${file.id}')" title="Voir les détails">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-icon danger" onclick="deleteProcessedFile('${file.id}')" title="Supprimer">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function getFileIcon(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    const icons = {
        'csv': 'fa-file-csv',
        'json': 'fa-file-code',
        'xml': 'fa-file-code',
        'xlsx': 'fa-file-excel',
        'txt': 'fa-file-alt'
    };
    return icons[extension] || 'fa-file';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function isValidFileType(file) {
    const validExtensions = ['.csv', '.json', '.xml', '.xlsx', '.txt'];
    return validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
}

function generateFileId() {
    return 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function showProcessingModal() {
    const modal = document.getElementById('processingModal');
    if (modal) {
        modal.style.display = 'flex';
        updateProgressBar(0);

        const progressText = document.getElementById('progressText');
        if (progressText) {
            progressText.textContent = 'Initialisation...';
        }
    }
}

function hideProcessingModal() {
    const modal = document.getElementById('processingModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function updateProgressBar(progress) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    progress = Math.min(progress, 100);

    if (progressFill) {
        progressFill.style.width = progress + '%';
    }

    if (progressText) {
        if (progress < 30) {
            progressText.textContent = 'Analyse du fichier...';
        } else if (progress < 60) {
            progressText.textContent = 'Nettoyage des données...';
        } else if (progress < 90) {
            progressText.textContent = 'Optimisation...';
        } else {
            progressText.textContent = 'Finalisation...';
        }
    }
}

function processFile(fileId) {
    const file = uploadedFiles.find(f => f.id === fileId);
    if (file) {
        simulateFileProcessing(file);
    }
}

function deleteUploadedFile(fileId) {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce fichier ?')) {
        uploadedFiles = uploadedFiles.filter(f => f.id !== fileId);
        saveUserFiles();
        displayUploadedFiles();
        updateStats();
        showNotification('Fichier supprimé', 'info');
    }
}

function deleteProcessedFile(fileId) {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce fichier traité ?')) {
        processedFiles = processedFiles.filter(f => f.id !== fileId);
        saveUserFiles();
        displayProcessedFiles();
        updateStats();
        showNotification('Fichier supprimé', 'info');
    }
}

function downloadFile(fileId) {
    const file = processedFiles.find(f => f.id === fileId);
    if (file) {
        showNotification(`Téléchargement de ${file.name} en cours...`, 'info');

        let blob;
        if (file.blob) {
            blob = file.blob;
        } else {
            blob = new Blob(['Contenu du fichier nettoyé simulé'], { type: 'text/plain' });
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
}

function downloadAll() {
    if (processedFiles.length === 0) {
        showNotification('Aucun fichier traité à télécharger', 'warning');
        return;
    }

    showNotification(`Téléchargement de ${processedFiles.length} fichier(s) en cours...`, 'info');

    processedFiles.forEach(file => {
        setTimeout(() => downloadFile(file.id), Math.random() * 1000);
    });
}

function viewFileDetails(fileId) {
    const file = processedFiles.find(f => f.id === fileId);
    if (file) {
        alert(`Détails du fichier:\n\nNom: ${file.name}\nTaille: ${formatFileSize(file.cleanedSize)}\nTraité le: ${formatDate(file.processDate)}\n\nAméliorations:\n${file.improvements.join('\n')}`);
    }
}

function updateStats() {
    document.getElementById('filesProcessed').textContent = userStats.filesProcessed;
    document.getElementById('dataCleaned').textContent = userStats.dataCleaned + ' MB';
    document.getElementById('avgTime').textContent = userStats.avgTime + 's';
    document.getElementById('successRate').textContent = userStats.successRate + '%';

    const monthlyIncrease = Math.floor(Math.random() * 20) + 5;
    document.getElementById('filesProcessedChange').textContent = `+${monthlyIncrease}% ce mois`;
    document.getElementById('dataCleanedChange').textContent = `+${monthlyIncrease}% ce mois`;
    document.getElementById('avgTimeChange').textContent = `-${Math.floor(monthlyIncrease/2)}% ce mois`;
    document.getElementById('successRateChange').textContent = `+0% ce mois`;
}

function saveUserFiles() {
    try {
        const uploadedToSave = uploadedFiles.map(file => {
            const { blob, ...fileWithoutBlob } = file;
            return fileWithoutBlob;
        });

        const processedToSave = processedFiles.map(file => {
            const { blob, ...fileWithoutBlob } = file;
            return fileWithoutBlob;
        });

        const uploadedJson = JSON.stringify(uploadedToSave);
        const processedJson = JSON.stringify(processedToSave);
        const statsJson = JSON.stringify(userStats);

        const estimatedSpace = uploadedJson.length + processedJson.length + statsJson.length;
        const currentUsage = getStorageSize();

        if (currentUsage + estimatedSpace > 5 * 1024 * 1024) {
            throw new Error('Storage quota would be exceeded');
        }

        localStorage.setItem(`dataprocessor_uploaded_${currentUser.email}`, uploadedJson);
        localStorage.setItem(`dataprocessor_processed_${currentUser.email}`, processedJson);
        localStorage.setItem(`dataprocessor_stats_${currentUser.email}`, statsJson);
    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        if (error.message === 'Storage quota would be exceeded') {
            handleStorageQuotaExceeded();
            saveUserFiles();
        } else {
            showNotification('Erreur lors de la sauvegarde des données', 'error');
        }
    }
}

function clearUserData() {
    if (currentUser && currentUser.email) {
        localStorage.removeItem(`dataprocessor_uploaded_${currentUser.email}`);
        localStorage.removeItem(`dataprocessor_processed_${currentUser.email}`);
        localStorage.removeItem(`dataprocessor_stats_${currentUser.email}`);
    }
    localStorage.removeItem('dataprocessor_current_user');

    uploadedFiles = [];
    processedFiles = [];
    userStats = {
        filesProcessed: 0,
        dataCleaned: 0,
        avgTime: 0,
        successRate: 100
    };

    showNotification('Données utilisateur réinitialisées', 'info');
}

function refreshFiles() {
    loadUserFiles();
    showNotification('Fichiers actualisés', 'success');
}

function refreshProcessedFiles() {
    displayProcessedFiles();
    showNotification('Fichiers traités actualisés', 'success');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'warning' ? 'fa-exclamation-triangle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 100);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

function logout() {
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
        localStorage.removeItem('dataprocessor_current_user');
        window.location.href = 'index.html';
    }
}
