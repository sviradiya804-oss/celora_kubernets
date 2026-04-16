/**
 * Utility to sort jewelry images based on color and view sequence
 * Color Priority: rg (Rose Gold) < wg (White Gold) < yg (Yellow Gold)
 * View Priority: a < b < c < d ...
 */

const COLOR_PRIORITY = {
    'rg': 1,
    'wg': 2,
    'yg': 3
};

function sortJewelryImages(imageUrls) {
    if (!Array.isArray(imageUrls)) return imageUrls;

    return [...imageUrls].sort((a, b) => {
        const infoA = getImageInfo(a);
        const infoB = getImageInfo(b);

        // 1. Sort by Color
        if (infoA.colorPriority !== infoB.colorPriority) {
            return infoA.colorPriority - infoB.colorPriority;
        }

        // 2. Sort by View/Sequence (a, b, c...)
        return infoA.view.localeCompare(infoB.view);
    });
}

function getImageInfo(url) {
    const filename = url.split('/').pop().toLowerCase();
    const nameWithoutExt = filename.split('.')[0];
    const parts = nameWithoutExt.split('-');

    // Find color (rg, wg, yg)
    let colorPriority = 99;
    for (const part of parts) {
        if (COLOR_PRIORITY[part]) {
            colorPriority = COLOR_PRIORITY[part];
            break;
        }
    }

    // Find view (the last alphabetical part, e.g., 'a', 'b', 'c')
    // Usually the last part after the last hyphen
    const view = parts[parts.length - 1] || '';

    return {
        colorPriority,
        view
    };
}

module.exports = {
    sortJewelryImages
};
