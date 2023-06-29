function setSmoothScaling(ctx) {
    ctx.webkitImageSmoothingEnabled = true;
    ctx.msImageSmoothingEnabled = true;
    ctx.mozImageSmoothingEnabled = true;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
}

function setRoughScaling(ctx) {
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.imageSmoothingEnabled = false;
}

function browserCreateCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

async function transformImageCrop(imgSrc) {
    return new Promise((resolve, reject) => {
        let img = new Image();
        img.setAttribute("crossOrigin", "Anonymous");
        img.onload = async () => {
            const width = Math.floor(img.naturalWidth * 0.9);
            const height = Math.floor(img.naturalHeight * 0.85);
            
            pica = new $ed498a97b604fad5$var$Pica();

            canvas = browserCreateCanvas(width, height);

            const fromCtx = canvas.getContext("2d", {willReadFrequently: true});
            fromCtx.drawImage(img, Math.floor(-width * 0.06), Math.floor(-height * 0.1));

            resolve(canvas.toDataURL());
        }
        img.onerror = reject;
        img.src = imgSrc;
    })
}

async function transformImageForPreHashing(imgSrc, size) {
    return new Promise((resolve, reject) => {
        let img = new Image();
        img.setAttribute("crossOrigin", "Anonymous");
        img.onload = async () => {
            // Add solid background to ensure PNG with alpha compares correctly against JPG
            let canvas = browserCreateCanvas(img.naturalWidth, img.naturalHeight);
            const ctx = canvas.getContext("2d", {willReadFrequently: true});
            ctx.fillStyle = "black";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            // Check for portrait mobile screenshot
            let portraitRatio = img.naturalHeight / img.naturalWidth;

            if (portraitRatio > 1.7 && portraitRatio < 2.2) {
                // potentially mobile phone screenshot, check for embedded image

                const SMALL_CANVAS_WIDTH = 128;
                let smallCanvas = browserCreateCanvas(SMALL_CANVAS_WIDTH, Math.floor(SMALL_CANVAS_WIDTH * portraitRatio));
                const sCtx = smallCanvas.getContext("2d", {willReadFrequently: true});
                sCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
                let imageData = sCtx.getImageData(0, 0, smallCanvas.width, smallCanvas.height).data;

                let row = 0;
                let col = 0
                let solidPixelsInRow = 0;
                let solidRowPixelDiffs = 0;
                let solidRows = [];
                let rowColor = -1;
        
                // Scan for solid rows down the image
                for(let i = 0; i < imageData.length; i += 4) {
                    if (solidPixelsInRow >= 0) {
                        const red = imageData[i];
                        const green = imageData[i + 1];
                        const blue = imageData[i + 2];
                        const alpha = imageData[i + 3];
        
                        let newRowColor = red + green + blue + alpha;
        
                        if (rowColor < 0) {
                            rowColor = newRowColor;
                        } else {
                            let sufficientlyDifferent = Math.abs(newRowColor - rowColor) < 2;
                            rowColor = newRowColor;
                            if (sufficientlyDifferent) {
                                solidPixelsInRow++;
                            } else {
                                console.log("diff@",col,rowColor,"vs new",newRowColor,"(",red,green,blue,alpha,")");
                                solidRowPixelDiffs++;
                                if (solidRowPixelDiffs > SMALL_CANVAS_WIDTH * 0.1) {
                                    solidPixelsInRow = -1;
                                    console.log("Marking row non-solid");
                                }
                            }
                        }
                    }
        
                    col++;
                    if (col >= smallCanvas.width) {
                        if (solidPixelsInRow > Math.floor(SMALL_CANVAS_WIDTH * 0.9)) {
                            solidRows.push(row);
                        }
        
                        col = 0;
                        row++;
                        solidPixelsInRow = 0;
                        console.log("row", row, "col", col, "SolidRowPixelDiffs:",solidRowPixelDiffs);
                        solidRowPixelDiffs = 0;
                    } 
                }

                let solidBorders = 0;
                let solidCenters = 0;

                for (let y = 0; y < Math.floor(smallCanvas.height * 0.25); y++) {
                    if (solidRows.includes(y)) {
                        solidBorders++;
                    }
                }
                for (let y = Math.floor(smallCanvas.height * 0.75); y < smallCanvas.height; y++) {
                    if (solidRows.includes(y)) {
                        solidBorders++;
                    }
                }
                for (let y = Math.floor(smallCanvas.height * 0.25); y < Math.floor(smallCanvas.height * 0.75); y++) {
                    if (solidRows.includes(y)) {
                        solidCenters++;
                    }
                }

                console.log("SOlid rows:",solidRows,"solid borders",solidBorders,"solid centers",solidCenters);

                if (solidRows.length > Math.floor(smallCanvas.height * 0.1) && solidBorders > solidCenters * 0.5) {
                    let screenshotDetected = true;
                    // detected potential screenshot, find inside image boundaries
                    let topVal = 0;

                    let jumped = false;
                    for (let y = 0; y < solidRows.length - 1; y++) {
                        if (solidRows[y + 1] < solidRows[y] + Math.floor(SMALL_CANVAS_WIDTH / 10)) {
                            topVal = y + 1;
                        } else if (solidRows[y + 1] < solidRows[y] + Math.floor(SMALL_CANVAS_WIDTH / 5) && !jumped) {
                            topVal = y + 1;
                            console.log("Jumped down");
                            jumped = true;
                        } else {
                            break;
                        }

                        console.log(y, solidRows.length - 1);

                        if (y == solidRows.length - 1) {
                            screenshotDetected = false;
                        }
                    }



                    if (screenshotDetected) {

                        let topRow = solidRows[topVal];

                        let botVal = 0;
                        let botRow = Math.floor(smallCanvas.height) - topRow;

                        if (solidRows.includes(Math.floor(smallCanvas.height) - 1)) {
                            for (let y = solidRows.length - 1; y > 1; y--) {
                                if (solidRows[y - 1] > solidRows[y] - Math.floor(SMALL_CANVAS_WIDTH / 5)) {
                                    botVal = y - 1;
                                } else {
                                    break;
                                }
                            }
                            botRow = solidRows[botVal];
                        }

                        console.log("Cutting",topRow,botRow);

                        let hScaleFactor = (canvas.height / smallCanvas.height);
                        let newHeight = Math.floor((botRow - topRow) * hScaleFactor);

                        let originalCanvas = canvas;
                        canvas = browserCreateCanvas(canvas.width, newHeight);
                        const newCtx = canvas.getContext("2d", {willReadFrequently: true});
                        newCtx.drawImage(originalCanvas, 0, -Math.floor(topRow * hScaleFactor));
                    }
                }
            }

            let dataUrl = canvas.toDataURL();

            resolve(dataUrl);
        }
        img.onerror = reject;
        img.src = imgSrc;
    })
}

async function transformImageResize(imgSrc, ratio) {
    return new Promise((resolve, reject) => {
        let img = new Image();
        img.setAttribute("crossOrigin", "Anonymous");
        img.onload = async () => {
            if (ratio > 2) {
                ratio = ratio / img.naturalWidth;
            }
            const width = Math.floor(img.naturalWidth * ratio);
            const height = Math.floor(img.naturalHeight * ratio);
            
            pica = new $ed498a97b604fad5$var$Pica();

            toCanvas = browserCreateCanvas(width, height);
            fromCanvas = browserCreateCanvas(img.naturalWidth, img.naturalHeight);

            const fromCtx = fromCanvas.getContext("2d", {willReadFrequently: true});
            fromCtx.drawImage(img, 0, 0);

            await pica.resize(fromCanvas, toCanvas);

            resolve(toCanvas.toDataURL());
        }
        img.onerror = reject;
        img.src = imgSrc;
    })
}

async function transformImageOffset(imgSrc) {
    return new Promise((resolve, reject) => {
        let img = new Image();
        img.setAttribute("crossOrigin", "Anonymous");
        img.onload = () => {
            const width = img.naturalWidth;
            const height = img.naturalHeight;
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d", {willReadFrequently: true});
            setSmoothScaling(ctx);
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, width * 0.15, height * 0.35, width * 0.6, height * 0.6);
            resolve(canvas.toDataURL());
        }
        img.onerror = reject;
        img.src = imgSrc;
    })
}

async function transformImageJpeg(imgSrc, quality) {
    return new Promise((resolve, reject) => {
        let img = new Image();
        img.setAttribute("crossOrigin", "Anonymous");
        img.onload = () => {
            const width = img.naturalWidth;
            const height = img.naturalHeight;
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d", {willReadFrequently: true});
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", quality));
        }
        img.onerror = reject;
        img.src = imgSrc;
    })
}

async function transformImagePortraitScreenshot(imgSrc, backgroundSrc = null) {
    return new Promise((resolve, reject) => {
        let img = new Image();
        img.setAttribute("crossOrigin", "Anonymous");
        img.onload = async () => {
            const aspectRatio = img.naturalWidth / img.naturalHeight;
            const iPhoneWidth = 1170;
            const iPhoneHeight = 2532;
            const canvas = document.createElement("canvas");
            canvas.width = iPhoneWidth / 3;
            canvas.height = iPhoneHeight / 3;
            const ctx = canvas.getContext("2d", {willReadFrequently: true});
            if (backgroundSrc) {
                let backgroundImg = new Image();
                backgroundImg.setAttribute("crossOrigin", "Anonymous");
                var onloadPromise = new Promise((onloadResolve, onloadReject) => {
                    backgroundImg.onload = () => {
                        onloadResolve();
                    }
                    backgroundImg.src = backgroundSrc;
                });
                await onloadPromise;
                ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);
            } else {
                ctx.fillStyle = "black";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            
            const height = canvas.width / aspectRatio;
            setSmoothScaling(ctx);
            ctx.drawImage(img, 0, canvas.height / 2 - height / 2, canvas.width, height);
            resolve(canvas.toDataURL());
        }
        img.onerror = reject;
        img.src = imgSrc;
    })
}