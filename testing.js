"use strict";

const progressBar = document.getElementById("progress-bar");

function updateProgressBar(percentage) {
    let p = Math.floor(percentage);
    progressBar.setAttribute("aria-valuenow", p);
    progressBar.style.width = `${p}%`;
}

function centeredQuotes() {
    let div = document.createElement("div");
    div.style.display = "inline-block";
    div.style.width = "100%";
    div.style.textAlign = "center";
    div.innerText = '"';
    return div;
}

function hide(element) {
    element.classList.add("d-none");
}

function show(element) {
    element.classList.remove("d-none");
}

function shortened(src) {
    let hash = hashOnly(src);
    return "..." + hash.substr(hash.length - 10);
}

function hashOnly(src) {
    let slashIndex = src.lastIndexOf("/");
    if (slashIndex < 0) {
        slashIndex = 0;
    } else {
        slashIndex++;
    }
    
    return src = src.substr(slashIndex, src.length - 4);
}

function shortenedAndLinked(src) {
    let shortenedSrc = shortened(src);
    let link = document.createElement("a");
    link.href = src;
    link.innerText = shortenedSrc;
    link.target = "_blank";
    return link;
}

function addRow(items) {
    let row = document.createElement("tr");
    for (let item of items) {
        let cell = document.createElement("td");
        if (item instanceof HTMLElement) {
            cell.appendChild(item);
        } else {
            cell.innerText = item;
        }
        row.appendChild(cell);
    }
    testCasesTableTbody.appendChild(row);
}

const runTestsButton = document.getElementById("run-tests");
const testCasesHeader = document.getElementById("test-cases-header");
const testCasesTable = document.getElementById("test-cases-table");
const testCasesTableTbody = document.getElementById("test-cases-table-tbody");
const previewImage = document.getElementById("preview-image");
const hidePreviewImage = document.getElementById("hide-preview-image");
const resultsArea = document.getElementById("results-area");

var hashResults = {};

const groundTruth = "ground_truth";

var transformedImages = {};

async function transformImage(imgSrc, transform) {
    let transformedImgSrc = imgSrc;
    let imgTransformKey = imgSrc + transform.name;

    if (imgTransformKey in transformedImages) {
        return transformedImages[imgTransformKey];
    }

    transformedImgSrc = await transform.asyncFunction(imgSrc);

    transformedImages[imgTransformKey] = transformedImgSrc;
    return transformedImgSrc;
}

const transforms = [
    {
        name: groundTruth,
        asyncFunction: (imgSrc) => new Promise((r, _) => r(imgSrc))
    },
    // {
    //     // Twitter media thumbnail size
    //     name: "resize_240",
    //     asyncFunction: (imgSrc) => transformImageResize(imgSrc, 240)
    // }, 
    // {
    //     // highly jpegified
    //     name: "jpeg_10",
    //     asyncFunction: (imgSrc) => transformImageJpeg(imgSrc, 0.1)
    // },
    // {
    //     // poorly cropped
    //     name: "edge_crop",
    //     asyncFunction: (imgSrc) => transformImageCrop(imgSrc)
    // },

    // tricker scenarios
    
    {
        name: "portrait_screenshot",
        asyncFunction: (imgSrc) => transformImagePortraitScreenshot(imgSrc)
    },
    {
        name: "iphone_gallery",
        asyncFunction: (imgSrc) => transformImagePortraitScreenshot(imgSrc, assets["iphone-gallery.jpg"])
    },
    // {
    //     name: "offset",
    //     asyncFunction: (imgSrc) => transformImageOffset(imgSrc)
    // }
]

const hashFuncs = [
    // {
    //     name: "pre-cacher",
    //     asyncFunction: async (img) => ImageHash.fromBase64("00")
    // },
    {
        name: "phash",
        asyncFunction: async (img) => await phash(img)
    },
    // {
    //     name: "whash(4)",
    //     asyncFunction: async (img) => await whash(img, 4)
    // },
]

hidePreviewImage.addEventListener("click", () => {
    previewImage.src = "";
});

previewImage.addEventListener("click", () => {
    previewImage.src = "";
});

let testResults = {};
let jsonOut = {};

runTestsButton.addEventListener("click", async () => {
    runTests();
});

async function runTests() {
    hide(runTestsButton);
    show(resultsArea);

    testResults = {};
    jsonOut = {};

    await executeHashes();
    computeSummary();
    displaySummary();
}

function computeSummary() {
    for (let hashFuncName in testResults) {
        let results = testResults[hashFuncName];
        results["hash_hit_rate"] = results["hash_hits"] / (results["hash_hits"] + results["hash_misses"]);
        results["avg_time"] = results["compute_times"].reduce((a, b) => a + b) / results["compute_times"].length;
        results["min_cross_hamming_dist"] = {
            "distance": 999999999,
            "sample_img_src": "",
            "sample_hash": "",
            "test_ground_truth_img_src": "",
            "test_hash": "",
        };

        for (let sampleImgSrc in results["ground_truth_hashes"]) {
            const sampleHash = results["ground_truth_hashes"][sampleImgSrc];

            jsonOut[sampleHash.toHexString()] = {
                src: hashOnly(sampleImgSrc)
            };

            // Compare against all other samples' hashes
            for (let testImgSrc in results["ground_truth_hashes"]) {
                if (sampleImgSrc == testImgSrc) {
                    continue;
                }
                
                const testHash = results["ground_truth_hashes"][testImgSrc];
                const hammingDistance = sampleHash.hammingDistance(testHash);
                
                console.log("Cross hamming distance (between samples)", hammingDistance);

                if (hammingDistance < results["min_cross_hamming_dist"]["distance"]) {
                    results["min_cross_hamming_dist"] = {
                        "distance": hammingDistance,
                        "sample_img_src": sampleImgSrc,
                        "sample_hash": sampleHash,
                        "test_ground_truth_img_src": testImgSrc,
                        "test_hash": testHash
                    }
                }
            }

            // Compare against all other samples' transformed hashes
            for (let testImgSrc in results["transformed_hashes"]) {
                if (sampleImgSrc == testImgSrc) {
                    continue;
                }
                const transformedHashesForImg = results["transformed_hashes"][testImgSrc];
                for (let transformedImgSrc in transformedHashesForImg) {
                    const testHash = transformedHashesForImg[transformedImgSrc];
                    const hammingDistance = sampleHash.hammingDistance(testHash);
                    
                    if (hammingDistance < results["min_cross_hamming_dist"]["distance"]) {
                        results["min_cross_hamming_dist"] = {
                            "distance": hammingDistance,
                            "sample_img_src": sampleImgSrc,
                            "sample_ground_truth_hash": sampleHash,
                            "test_ground_truth_img_src": transformedImgSrc,
                            "test_hash": testHash
                        }
                    }
                }
            }
        }
    }

    console.log(testResults);
}

function displaySummary() {
    console.log(jsonOut);
}

async function executeHashes() {
    for (let hashFunc of hashFuncs) {
        const hashFuncHeader = document.createElement("h5");
        hashFuncHeader.innerText = hashFunc.name;

        testResults[hashFunc.name] = {
            "hash_hits": 0,
            "hash_misses": 0,
            "max_match_hamming_dist": {
                "distance": -1,
                "transform": "",
                "img_src": "",
            },
            "min_cross_hamming_dist": {
                "distance": 999999999,
                "sample_img_src": "",
                "sample_ground_truth_hash": "",
                "test_ground_truth_img_src": "",
                "test_transform_hash": "",
            },
            "compute_times": [],
            "ground_truth_hashes": {},
            "transformed_hashes": {}
        }
    
        addRow([
            "",
            hashFuncHeader,
            "",
            "",
            "",
            ""
        ]);
        await runSamples(hashFunc);
    }
}

async function getHash(hashFunc, transformedImgSrc) {
    let start = Date.now();
    return new Promise((resolve, reject) => {
        const img = document.createElement("img");

        img.addEventListener("load", async () => {
            const hash = await hashFunc.asyncFunction(img)
            resolve({
                start: start,
                hash: hash
            });
        });

        img.setAttribute("crossorigin", "Anonymous");
        img.src = transformedImgSrc;
    });
}

async function runSamples(hashFunc) {
    let counter = 0;

    for (let sampleImgUrl of samples) {
        updateProgressBar(100 * (counter / samples.length));
        try {
            let groundTruthHash = "";
            for (let transform of transforms) {
                console.log("Beginning transform:",transform);

                let hammingDistance = "";
                const originalImgSrc = sampleImgUrl;

                let transformedImgSrc = await transformImage(sampleImgUrl, transform);
                
                let processedImgSrc = await transformImage(transformedImgSrc, {
                    name: "pre-process",
                    asyncFunction: (i) => transformImageForPreHashing(i, 512)
                });



                const result = await getHash(hashFunc, processedImgSrc);

                let start = result.start;
                const hash = result.hash;

                if (transform.name == groundTruth) {
                    groundTruthHash = hash;
                    hammingDistance = "---";
                    testResults[hashFunc.name]["ground_truth_hashes"][sampleImgUrl] = hash;
                } else {
                    hammingDistance = hash.hammingDistance(groundTruthHash);

                    if (testResults[hashFunc.name]["max_match_hamming_dist"]["distance"] < hammingDistance) {
                        testResults[hashFunc.name]["max_match_hamming_dist"]["distance"] = hammingDistance;
                        testResults[hashFunc.name]["max_match_hamming_dist"]["img_src"] = originalImgSrc;
                        testResults[hashFunc.name]["max_match_hamming_dist"]["transform"] = transform.name;
                    }
                    if (hammingDistance == 0) {
                        testResults[hashFunc.name]["hash_hits"]++;
                    } else {
                        testResults[hashFunc.name]["hash_misses"]++;
                    }

                    if (!(sampleImgUrl in testResults[hashFunc.name]["transformed_hashes"])) {
                        testResults[hashFunc.name]["transformed_hashes"][sampleImgUrl] = {};
                    }
                    testResults[hashFunc.name]["transformed_hashes"][sampleImgUrl][transformedImgSrc] = hash;
                }
                let imageLink = document.createElement("a");
                imageLink.href = "javascript:;";
                imageLink.addEventListener("click", () => {
                    previewImage.src = processedImgSrc;
                });

                if (transform.name == groundTruth) {
                    let boldSpan = document.createElement("span");
                    boldSpan.style.fontWeight = "bold";
                    boldSpan.innerText = transform.name;
                    imageLink.append(boldSpan);
                } else {
                    imageLink.innerText = transform.name;
                }

                const computeTime = Date.now() - start;
                testResults[hashFunc.name]["compute_times"].push(computeTime);


                addRow([
                    (transform.name == groundTruth) ? shortenedAndLinked(originalImgSrc) : centeredQuotes(),
                    imageLink,
                    hashFunc.name,
                    computeTime,
                    hash.toHexString(),
                    hammingDistance
                ]);
            }
        } catch (error) {
            console.error(error, sampleImgUrl);
        }

        counter++;

        if (false && counter >= 50) {
            addRow([
                "",
                "(Remaining samples skipped)",
                "",
                "",
                "",
                ""
            ]);
            break;
        }
    }
}

async function wait() {
    return new Promise((r, _) => {
        setTimeout(r, 200);
    });
}

async function reproduceProblem() {
    const cami = {
        name: "cami",
        function: (img) => phash(img, 8, 4)
    };

    const url = "http://localhost:3000/positive/005e3faa785f907eb1a33fb715528c55.jpg";

    await transformImageResize(url, 1);
}

document.addEventListener("DOMContentLoaded", function () {
    runTests();
    //reproduceProblem();
});
