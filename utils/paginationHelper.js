class PaginationHelper {
    /**
     * Get pagination metadata
     * @param {number} page - Current page number
     * @param {number} limit - Records per page
     * @param {number} totalCount - Total number of records
     * @returns {Object} Pagination metadata
     */
    static getPaginationMetadata(page, limit, totalCount) {
        const currentPage = parseInt(page);
        const recordsPerPage = parseInt(limit);
        const totalPages = Math.ceil(totalCount / recordsPerPage);
        
        return {
            currentPage: currentPage,
            totalPages: totalPages,
            totalRecords: totalCount,
            recordsPerPage: recordsPerPage,
            hasNextPage: currentPage < totalPages,
            hasPrevPage: currentPage > 1,
            hasMore: currentPage < totalPages // Alias for hasNextPage, commonly used in infinite scroll
        };
    }

    /**
     * Calculate skip/offset value for database queries
     * @param {number} page - Current page number
     * @param {number} limit - Records per page
     * @returns {number} Skip/offset value
     */
    static getSkip(page, limit) {
        return (parseInt(page) - 1) * parseInt(limit);
    }

    /**
     * Get page range for pagination UI
     * @param {number} currentPage - Current page number
     * @param {number} totalPages - Total number of pages
     * @param {number} maxVisible - Maximum number of page buttons to show
     * @returns {Array} Array of page numbers to display
     */
    static getPageRange(currentPage, totalPages, maxVisible = 5) {
        const pages = [];
        
        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            const halfVisible = Math.floor(maxVisible / 2);
            let start = Math.max(1, currentPage - halfVisible);
            let end = Math.min(totalPages, currentPage + halfVisible);

            // Adjust if we're near the start or end
            if (currentPage <= halfVisible) {
                end = maxVisible;
            } else if (currentPage >= totalPages - halfVisible) {
                start = totalPages - maxVisible + 1;
            }

            for (let i = start; i <= end; i++) {
                pages.push(i);
            }
        }
        
        return pages;
    }
}

module.exports = PaginationHelper;