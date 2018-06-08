(function () {
    var URL = window.URL || window.webkitURL;

    var imageFile = document.getElementById('image-file');
    var imageBtn = document.getElementById('image-btn');
    var decodeBtn = document.getElementById('decode-btn');
    var msgInput = document.getElementById('msg');
    var previewImage = document.getElementById('preview-image');
    var resultImage = document.getElementById('result-image');

    var base = 2;
    var channels = 3;
    var secret = '';

    imageFile.addEventListener('change', showPreviewImage);
    imageBtn.addEventListener('click', encode);
    decodeBtn.addEventListener('click', decode);

    function showPreviewImage() {
        var file = imageFile.files[0];
        var url = URL.createObjectURL(file);
        previewImage.src = url;
    }

    function encode() {
        var fr = new FileReader();
        fr.onload = function (e) {
            var arrBuff = e.target.result;
            Jimp.read(arrBuff, function (err, image) {
                var msgArray = textArr(msgInput.value, base);
                var entries = image.bitmap.width * image.bitmap.height * channels;

                var headerLength = Math.ceil(Math.log2(entries) / Math.log2(base));
                var neededBitLen = msgArray.length + headerLength;

                // safety check
                var bitLenCapacity = Math.max(entries * Math.log2(base)) + 1;
                if (neededBitLen > bitLenCapacity) return alert('Not enough capacity');

                var headerContents = bigInt(msgArray.length).toArray(base).value;
                var header = new Array(headerLength - headerContents.length).fill(0).concat(headerContents);

                // create write order
                var indexes = new Array(entries);
                for (var i = 0; i < indexes.length / 3; i++) {
                    indexes[i * 3] = i * 4;
                    indexes[i * 3 + 1] = i * 4 + 1;
                    indexes[i * 3 + 2] = i * 4 + 2;
                }

                indexes.sort(hashSort); // sort is bases on a hash

                // encode
                var payload = header.concat(msgArray);

                for (var j = 0; j < payload.length; j++) {
                    var part = payload[j];
                    var index = indexes[j];
                    var pixVal = image.bitmap.data[index];
                    var val = Math.floor(pixVal / base) * base + part;
                    image.bitmap.data[index] = val;
                }

                // result
                image.getBase64('image/png', function (err, base64) {
                    resultImage.src = base64;
                });
            });
        }
        try {
            fr.readAsArrayBuffer(imageFile.files[0]);
        } catch(err) {
            alert('Unable to read image');
        }
    }

    function decode(cb) {
        var fr = new FileReader();
        fr.onload = function (e) {
            var arrBuff = e.target.result;
            Jimp.read(arrBuff, function (err, image) {
                var entries = image.bitmap.width * image.bitmap.height * channels;

                // create write order
                var indexes = new Array(entries);
                for (var i = 0; i < indexes.length / 3; i++) {
                    indexes[i * 3] = i * 4;
                    indexes[i * 3 + 1] = i * 4 + 1;
                    indexes[i * 3 + 2] = i * 4 + 2;
                }

                indexes.sort(hashSort); // sort is bases on a hash

                // decode

                var headerLength = Math.ceil(Math.log2(entries) / Math.log2(base))

                var header = new Array(headerLength);
                for (var k = 0; k < headerLength; k++) {
                    var index = indexes[k];
                    var pixVal = image.bitmap.data[index];
                    header[k] = pixVal % base;
                }

                var msgLength = bigInt.fromArray(header, base).toJSNumber();
                var result = new Array(msgLength);

                for (var j = 0; j < msgLength; j++) {
                    var index = indexes[j + headerLength];
                    var pixVal = image.bitmap.data[index];
                    result[j] = pixVal % base;
                }

                var msg = textFromResult(result, base);
                alert(msg);
            });
        }
        try {
            fr.readAsArrayBuffer(imageFile.files[0]);
        } catch(err) {
            alert('Unable to read image');
        }
    }

    function hash(str) {
        var hash = 0, i, chr;
        if (str.length === 0) return hash;
        for (i = 0; i < str.length; i++) {
            chr = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    };

    function hashSort(a, b) {
        return hash(secret + (b % 13 >> 2 * b).toString(b % 34 + 2))
            - hash(secret + (a % 13 >> 2 * a).toString(b % 34 + 2));
    }

    function fill(arr, val) {
        for (var i = 0; i < arr.length; i++) arr[i] = val;
        return arr;
    }

    function textArr(text, base) {
        return bigInt.fromArray(text.split('').map(function (c) { return c.charCodeAt(0) }), 65025).toArray(base).value;
    }

    function textFromResult(resultArr, base) {
        return bigInt.fromArray(resultArr, base).toArray(65025).value
            .map(function (x) { return String.fromCharCode(x); }).join('');
    }
})();
