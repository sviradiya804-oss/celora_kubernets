const { sendUnifiedOrderEmail } = require('../utils/unifiedEmailService');

/**
 * Enhanced order status update function with unified email template
 * @param {string} orderId - Order ID
 * @param {string} newStatus - New order status
 * @param {string} customerEmail - Customer's email
 * @param {Object} options - Additional options
 */
const updateOrderStatusWithEmail = async (orderId, newStatus, customerEmail, options = {}) => {
    try {
        // Find the order and populate customer data
        const order = await Order.findById(orderId).populate('customer');
        
        if (!order) {
            throw new Error('Order not found');
        }

        const oldStatus = order.status;
        
        // Update order status
        order.status = newStatus;
        order.statusHistory = order.statusHistory || [];
        order.statusHistory.push({
            status: newStatus,
            timestamp: new Date(),
            message: options.statusMessage
        });

        await order.save();

        // Prepare email data
        const emailData = {
            customerEmail: customerEmail || order.customer.email,
            customerName: order.customer.name,
            orderId: order._id,
            orderDate: order.createdAt.toLocaleDateString(),
            newStatus,
            oldStatus,
            statusMessage: options.statusMessage,
            total: order.total,
            products: (order.subOrders || []).map(item => ({
                name: item.productDetails?.title || item.productDetails?.name,
                quantity: item.quantity,
                price: item.priceAtTime || item.productDetails?.price || 0
            })),
            subtotal: order.subtotal,
            shipping: order.shipping || 0,
            tax: order.tax || 0,
            images: options.images || [],
            trackingInfo: options.trackingInfo,
            showNextSteps: options.showNextSteps !== false
        };

        // Send unified email
        const emailResult = await sendUnifiedOrderEmail(emailData);
        
        if (emailResult.success) {
            console.log(`Order status email sent successfully for order ${orderId}`);
        } else {
            console.error(`Failed to send status email for order ${orderId}:`, emailResult.error);
        }

        return {
            success: true,
            order,
            emailSent: emailResult.success,
            emailError: emailResult.error
        };

    } catch (error) {
        console.error('Error updating order status:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * API endpoint to update order status
 * PUT /api/orders/:orderId/status
 */
const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { 
            newStatus, 
            statusMessage, 
            customerEmail,
            images,
            trackingInfo 
        } = req.body;

        if (!newStatus) {
            return res.status(400).json({
                success: false,
                message: 'New status is required'
            });
        }

        const result = await updateOrderStatusWithEmail(orderId, newStatus, customerEmail, {
            statusMessage,
            images,
            trackingInfo,
            showNextSteps: true
        });

        if (result.success) {
            res.json({
                success: true,
                message: 'Order status updated successfully',
                data: {
                    orderId,
                    newStatus,
                    emailSent: result.emailSent
                }
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to update order status',
                error: result.error
            });
        }

    } catch (error) {
        console.error('Error in updateOrderStatus:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Batch update multiple orders
 * PUT /api/orders/batch-status
 */
const batchUpdateOrderStatus = async (req, res) => {
    try {
        const { orders } = req.body; // Array of {orderId, newStatus, statusMessage}

        if (!orders || !Array.isArray(orders)) {
            return res.status(400).json({
                success: false,
                message: 'Orders array is required'
            });
        }

        const results = [];

        for (const orderUpdate of orders) {
            const { orderId, newStatus, statusMessage, images, trackingInfo } = orderUpdate;
            
            const result = await updateOrderStatusWithEmail(orderId, newStatus, null, {
                statusMessage,
                images,
                trackingInfo
            });

            results.push({
                orderId,
                success: result.success,
                emailSent: result.emailSent,
                error: result.error
            });

            // Add delay to prevent overwhelming email service
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const successCount = results.filter(r => r.success).length;

        res.json({
            success: true,
            message: `Updated ${successCount} out of ${results.length} orders`,
            results
        });

    } catch (error) {
        console.error('Error in batchUpdateOrderStatus:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Get order status history
 * GET /api/orders/:orderId/status-history
 */
const getOrderStatusHistory = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findById(orderId).select('statusHistory status createdAt');
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.json({
            success: true,
            data: {
                orderId,
                currentStatus: order.status,
                statusHistory: order.statusHistory || []
            }
        });

    } catch (error) {
        console.error('Error getting order status history:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    updateOrderStatusWithEmail,
    updateOrderStatus,
    batchUpdateOrderStatus,
    getOrderStatusHistory
};
