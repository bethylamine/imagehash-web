

function hide(element) {
    element.classList.add("d-none");
}

function show(element) {
    element.classList.remove("d-none");
}

function shortened(src) {
    src = src.substr(src.length-10);
    src = src.substr(0, src.length - 4);
    return "..." + src;
}

function addRow(items) {
    let row = document.createElement("tr");
    for (item of items) {
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

function setSmoothScaling(ctx) {
    ctx.webkitImageSmoothingEnabled = true;
    ctx.msImageSmoothingEnabled = true;
    ctx.mozImageSmoothingEnabled = true;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
}

function transformImageResize(imgSrc, ratio) {
    return new Promise((resolve, reject) => {
        let img = new Image();
        img.setAttribute("crossOrigin", "Anonymous");
        img.onload = () => {
            if (ratio > 2) {
                ratio = 128 / img.naturalWidth;
            }
            const width = img.naturalWidth * ratio;
            const height = img.naturalHeight * ratio;
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            setSmoothScaling(ctx);
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL());
        }
        img.onerror = reject;
        img.src = imgSrc;
    })
}

function transformImageJpeg(imgSrc, quality) {
    return new Promise((resolve, reject) => {
        let img = new Image();
        img.setAttribute("crossOrigin", "Anonymous");
        img.onload = () => {
            const width = img.naturalWidth;
            const height = img.naturalHeight;
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", quality));
        }
        img.onerror = reject;
        img.src = imgSrc;
    })
}

function transformImagePortraitScreenshot(imgSrc) {
    return new Promise((resolve, reject) => {
        let img = new Image();
        img.setAttribute("crossOrigin", "Anonymous");
        img.onload = () => {
            const aspectRatio = img.naturalWidth / img.naturalHeight;
            const iPhoneWidth = 1170;
            const iPhoneHeight = 2532;
            const canvas = document.createElement("canvas");
            canvas.width = iPhoneWidth / 3;
            canvas.height = iPhoneHeight / 3;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "black";
            const height = canvas.width / aspectRatio;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            setSmoothScaling(ctx);
            ctx.drawImage(img, 0, canvas.height / 2 - height / 2, canvas.width, height);
            resolve(canvas.toDataURL());
        }
        img.onerror = reject;
        img.src = imgSrc;
    })
}

async function transformImage(imgSrc, transform) {
    let transformedImgSrc = imgSrc;

    if (transform == "ground_truth") {
        transformedImgSrc = imgSrc;
    } else if (transform == "resize_128") {
        transformedImgSrc = await transformImageResize(imgSrc, 128);
    } else if (transform == "jpeg_10") {
        transformedImgSrc = await transformImageJpeg(imgSrc, 0.1);
    } else if (transform == "portrait_screenshot") {
        transformedImgSrc = await transformImagePortraitScreenshot(imgSrc);
    }

    transformedImages[imgSrc + transform] = transformedImgSrc;
    return transformedImgSrc;
}

const runTestsButton = document.getElementById("run-tests");
const testCasesHeader = document.getElementById("test-cases-header");
const testCasesTable = document.getElementById("test-cases-table");
const testCasesTableTbody = document.getElementById("test-cases-table-tbody");
const previewImage = document.getElementById("preview-image");

var hashResults = {};

const groundTruth = "ground_truth";

const transforms = [
    groundTruth,
    "resize_128",
    "jpeg_10",
    "portrait_screenshot"
]
var transformedImages = {};

runTestsButton.addEventListener("click", async () => {
    hide(runTestsButton);
    show(testCasesHeader);
    show(testCasesTable);

    let counter = 0;

    hashResults = {};

    for (let sample of samples) {
        let groundTruthHash = "";
        for (let transformType of transforms) {
            const img = document.createElement("img");
            const originalImgSrc = sample.src;
            img.src = await transformImage(sample.src, transformType);
            img.setAttribute("crossorigin", "Anonymous");

            // Avoid race conditions by running in series.
            var result = await new Promise((resolve, reject) => {
                img.addEventListener("load", () => {
                    let start = Date.now();
                    const hash = phash(img, 8);
                    resolve({
                        start: start,
                        hash: hash
                    })
                });
            });

            let start = result.start;
            let hash = result.hash;

            if (transformType == groundTruth) {
                groundTruthHash = hash;
                hammingDistance = "---";
            } else {
                hammingDistance = hash.hammingDistance(groundTruthHash);
            }
            let imageLink = document.createElement("a");
            imageLink.href = "javascript:;";
            imageLink.addEventListener("click", () => {
                previewImage.src = img.src;
            });

            if (transformType == groundTruth) {
                let boldSpan = document.createElement("span");
                boldSpan.style.fontWeight = "bold";
                boldSpan.innerText = transformType;
                imageLink.append(boldSpan);
            } else {
                imageLink.innerText = transformType;
            }

            addRow([
                shortened(originalImgSrc),
                imageLink,
                "phash",
                Date.now() - start,
                hash.toHexString(),
                hammingDistance
            ]);
        }

        counter++;

        if (counter >= 5) {
            addRow([
                "",
                "Iteration stopped after 5 samples",
                "",
                "",
                "",
                ""
            ]);
            break;
        }
    }
});