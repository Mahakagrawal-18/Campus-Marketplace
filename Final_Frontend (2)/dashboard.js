function switchTab(type) {
    const items = document.querySelectorAll('.transaction-item');
    const buttons = document.querySelectorAll('.tab-btn');
    
    // Switch Active Button
    buttons.forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');

    // Filter Items
    items.forEach(item => {
        if(item.classList.contains(type)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function updateStatus(btn, status) {
    const parent = btn.closest('.transaction-item');
    const badge = parent.querySelector('.status-badge');
    
    if(status === 'Completed') {
        badge.innerText = 'Completed';
        badge.className = 'status-badge completed';
        parent.querySelector('.item-actions').innerHTML = 'Transaction Successful ✅';
        alert("The deal is closed! You have confirmed receipt of the item.");
    } else {
        parent.style.opacity = '0.5';
        parent.querySelector('.item-actions').innerHTML = 'Cancelled ❌';
        alert("Transaction Cancelled.");
    }
}