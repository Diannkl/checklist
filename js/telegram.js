// Initialize Telegram WebApp
let tg = window.Telegram.WebApp;

// Initialize the app when the Telegram WebApp is ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the app
    tg.expand(); // Expand the WebApp to take full screen
    
    // Set the header color to match our app's theme
    tg.setHeaderColor('#1e3a8a');
    
    // Set the background color
    tg.setBackgroundColor('#f8f9fa');
    
    // Get user data if available
    const user = tg.initDataUnsafe?.user;
    if (user) {
        console.log('Telegram user:', user);
        // You can use user data to personalize the experience
    }
    
    // Handle back button
    tg.BackButton.onClick(() => {
        navigateBack();
    });
    
    // Initialize app functionality
    initApp();
});

// Main function to initialize the app
function initApp() {
    // Define elements
    const screens = {
        home: document.getElementById('home-screen'),
        addTask: document.getElementById('add-task-screen'),
        taskDetails: document.getElementById('task-details-screen'),
        stats: document.getElementById('stats-screen')
    };
    
    // Navigation elements
    const navItems = document.querySelectorAll('.nav-item');
    const backButtons = document.querySelectorAll('.back-button');
    const addButton = document.querySelector('.add-button');
    
    // Form elements
    const taskForm = {
        name: document.getElementById('task-name'),
        description: document.getElementById('task-description'),
        toggleOptions: document.querySelectorAll('.toggle-option'),
        recurringOptions: document.querySelector('.recurring-options'),
        days: document.querySelectorAll('.day'),
        saveButton: document.getElementById('save-task'),
        cancelButton: document.getElementById('cancel-task')
    };
    
    // Current active screen
    let currentScreen = 'home';
    let previousScreen = null;
    
    // Sample task data (in a real app, this would be stored in a database)
    let tasks = loadTasksFromStorage() || [];
    let completedTasks = loadCompletedTasksFromStorage() || [];
    
    // Initialize the app
    renderTasks();
    setupEventListeners();
    
    // Navigation functions
    function showScreen(screenName) {
        previousScreen = currentScreen;
        currentScreen = screenName;
        
        // Handle Telegram back button
        if (screenName === 'home') {
            tg.BackButton.hide();
        } else {
            tg.BackButton.show();
        }
        
        // Hide all screens first
        Object.values(screens).forEach(screen => {
            screen.classList.add('hidden');
        });
        
        // Show the selected screen with animation
        screens[screenName].classList.remove('hidden');
        if (screenName !== 'home') {
            screens[screenName].classList.add('slide-in-right');
            setTimeout(() => {
                screens[screenName].classList.remove('slide-in-right');
            }, 300);
        }
        
        // Update active nav item
        navItems.forEach(item => {
            item.classList.remove('active');
            const itemName = item.querySelector('span')?.textContent.toLowerCase();
            if (itemName === screenName || (itemName === 'stats' && screenName === 'stats')) {
                item.classList.add('active');
            }
        });
        
        // Special handling for certain screens
        if (screenName === 'stats') {
            renderStats();
        }
    }
    
    function navigateBack() {
        screens[currentScreen].classList.add('slide-out-right');
        
        setTimeout(() => {
            screens[currentScreen].classList.remove('slide-out-right');
            screens[currentScreen].classList.add('hidden');
            showScreen(previousScreen || 'home');
        }, 300);
    }
    
    // Task functions
    function renderTasks() {
        const taskListElement = document.getElementById('task-list');
        const emptyState = taskListElement.querySelector('.empty-state');
        
        // Clear existing tasks
        Array.from(taskListElement.children).forEach(child => {
            if (!child.classList.contains('empty-state')) {
                taskListElement.removeChild(child);
            }
        });
        
        // Show empty state if no tasks
        if (tasks.length === 0) {
            emptyState.style.display = 'flex';
            updateProgressCircle(0);
            updateTaskSummary(0, 0, 0);
            return;
        }
        
        // Hide empty state
        emptyState.style.display = 'none';
        
        // Calculate summary data
        const totalTasks = tasks.length;
        const today = new Date().toDateString();
        const todayTasks = tasks.filter(task => {
            if (task.type === 'one-time') {
                return new Date(task.date).toDateString() === today;
            } else {
                // For recurring tasks, check if today is one of the repeat days
                const dayOfWeek = new Date().getDay();
                const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                return task.repeatDays.includes(days[dayOfWeek]);
            }
        }).length;
        
        const overdueTasks = tasks.filter(task => {
            if (task.type === 'one-time' && !task.completed) {
                return new Date(task.date) < new Date() && new Date(task.date).toDateString() !== today;
            }
            return false;
        }).length;
        
        const completedCount = tasks.filter(task => task.completed).length;
        const completionPercentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
        
        // Update UI
        updateProgressCircle(completionPercentage);
        updateTaskSummary(totalTasks, todayTasks, overdueTasks);
        
        // Render each task
        tasks.forEach((task, index) => {
            const taskElement = document.createElement('div');
            taskElement.className = 'task-card';
            taskElement.dataset.index = index;
            
            const checkboxClass = task.completed ? 'task-checkbox checked' : 'task-checkbox';
            const checkIcon = task.completed ? '<i class="fas fa-check"></i>' : '';
            
            taskElement.innerHTML = `
                <div class="${checkboxClass}" data-index="${index}">${checkIcon}</div>
                <div class="task-content">
                    <div class="task-title">${task.name}</div>
                    <div class="task-desc">${task.description}</div>
                </div>
            `;
            
            // Add assignment badge if task is assigned
            if (task.assignedTo) {
                const taskTitle = taskElement.querySelector('.task-title');
                const assignedBadge = document.createElement('span');
                assignedBadge.className = 'task-assigned-badge';
                assignedBadge.textContent = 'Assigned';
                taskTitle.appendChild(assignedBadge);
            }
            
            taskListElement.appendChild(taskElement);
        });
        
        // Add notification for newly assigned tasks
        if (currentUserRole === 'subordinate') {
            const newAssignedTasks = tasks.filter(task => 
                task.assignedTo && task.isNew
            );
            
            if (newAssignedTasks.length > 0) {
                const notification = document.createElement('div');
                notification.className = 'new-task-notification';
                notification.innerHTML = `
                    <span>You have ${newAssignedTasks.length} new task(s) assigned to you</span>
                    <i class="fas fa-times dismiss-notification"></i>
                `;
                
                taskListElement.insertBefore(notification, taskListElement.firstChild);
                
                // Mark tasks as not new after showing notification
                newAssignedTasks.forEach(task => {
                    task.isNew = false;
                });
                saveTasksToStorage();
                
                // Add dismiss handler
                notification.querySelector('.dismiss-notification').addEventListener('click', () => {
                    notification.remove();
                });
            }
        }
    }
    
    function toggleTaskCompletion(index) {
        const task = tasks[index];
        task.completed = !task.completed;
        
        if (task.completed) {
            // Create confetti effect
            createConfetti(event);
            
            // Add to completed tasks history
            completedTasks.push({
                name: task.name,
                completedAt: new Date().toISOString()
            });
            
            saveCompletedTasksToStorage();
        }
        
        // Save tasks
        saveTasksToStorage();
        
        // Re-render task list
        renderTasks();
    }
    
    function showTaskDetails(index) {
        const task = tasks[index];
        
        // Set task details
        document.getElementById('detail-task-title').textContent = task.name;
        document.getElementById('detail-task-description').textContent = task.description;
        
        // Set frequency info
        const frequencyElement = document.getElementById('detail-frequency');
        if (task.type === 'one-time') {
            frequencyElement.querySelector('span').textContent = 'One-Time Task';
        } else {
            const days = task.repeatDays.map(day => day.charAt(0).toUpperCase() + day.slice(1)).join(', ');
            frequencyElement.querySelector('span').textContent = `Repeats on: ${days}`;
        }
        
        // Set complete button state
        const completeButton = document.getElementById('complete-task');
        if (task.completed) {
            completeButton.textContent = 'Completed';
            completeButton.disabled = true;
            completeButton.style.opacity = '0.7';
        } else {
            completeButton.innerHTML = '<i class="fas fa-check"></i> Mark as Completed';
            completeButton.disabled = false;
            completeButton.style.opacity = '1';
        }
        
        // Add event listener to complete button
        completeButton.onclick = () => {
            if (!task.completed) {
                toggleTaskCompletion(index);
                showTaskDetails(index); // Refresh details view
            }
        };
        
        // Show details screen
        showScreen('taskDetails');
    }
    
    function prepareEditTask(index) {
        const task = tasks[index];
        
        // Set form title
        document.getElementById('add-edit-title').textContent = 'Edit Task';
        
        // Fill form with task data
        taskForm.name.value = task.name;
        taskForm.description.value = task.description;
        
        // Set task type
        taskForm.toggleOptions.forEach(option => {
            option.classList.toggle('active', option.dataset.value === task.type);
        });
        
        // Show/hide recurring options
        taskForm.recurringOptions.classList.toggle('hidden', task.type !== 'recurring');
        
        // Set repeat days for recurring tasks
        if (task.type === 'recurring') {
            taskForm.days.forEach(day => {
                day.classList.toggle('selected', task.repeatDays.includes(day.dataset.day));
            });
        }
        
        // Update save button to handle edit
        taskForm.saveButton.dataset.mode = 'edit';
        taskForm.saveButton.dataset.index = index;
        
        // Show add/edit screen
        showScreen('addTask');
    }
    
    function deleteTask(index) {
        tasks.splice(index, 1);
        saveTasksToStorage();
        navigateBack(); // Go back to home screen
        renderTasks(); // Re-render task list
    }
    
    function createTask() {
        const name = taskForm.name.value.trim();
        const description = taskForm.description.value.trim();
        const type = document.querySelector('.toggle-option.active').dataset.value;
        
        if (!name) {
            tg.showPopup({
                title: 'Error',
                message: 'Please enter a task name',
                buttons: [{type: 'ok'}]
            });
            return false;
        }
        
        const task = {
            name,
            description,
            type,
            completed: false,
            date: new Date().toISOString()
        };
        
        if (type === 'recurring') {
            task.repeatDays = Array.from(document.querySelectorAll('.day.selected')).map(day => day.dataset.day);
            if (task.repeatDays.length === 0) {
                tg.showPopup({
                    title: 'Error',
                    message: 'Please select at least one day for recurring tasks',
                    buttons: [{type: 'ok'}]
                });
                return false;
            }
        }
        
        // Add assignee information if in director mode and an assignee is selected
        if (currentUserRole === 'director') {
            const assigneeId = document.getElementById('hidden-assignee-id')?.value;
            if (assigneeId) {
                task.assignedTo = parseInt(assigneeId);
                // Find the assignee name for display
                const assignee = subordinates.find(s => s.id === parseInt(assigneeId));
                if (assignee) {
                    task.assigneeName = assignee.name;
                    task.assigneeInitials = assignee.initials;
                }
            }
        }
        
        return task;
    }
    
    function updateProgressCircle(percentage) {
        const circle = document.querySelector('.circle');
        const percentageText = document.querySelector('.percentage');
        
        circle.style.setProperty('--progress', percentage);
        circle.setAttribute('stroke-dasharray', `${percentage}, 100`);
        percentageText.textContent = `${percentage}%`;
    }
    
    function updateTaskSummary(total, today, overdue) {
        const countElements = document.querySelectorAll('.count');
        countElements[0].textContent = total;
        countElements[1].textContent = today;
        countElements[2].textContent = overdue;
    }
    
    function createConfetti(event) {
        // Create colorful confetti particles when a task is completed
        const colors = ['#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#8b5cf6'];
        const container = document.querySelector('.app-container');
        
        for (let i = 0; i < 30; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = `${Math.random() * 100}%`;
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDuration = `${Math.random() * 2 + 1}s`;
            
            container.appendChild(confetti);
            
            setTimeout(() => {
                confetti.remove();
            }, 2000);
        }
    }
    
    function renderStats() {
        if (completedTasks.length === 0) {
            document.querySelector('#stats-screen .empty-state').style.display = 'flex';
            return;
        }
        
        document.querySelector('#stats-screen .empty-state').style.display = 'none';
        
        // Render completion chart
        renderCompletionChart();
        
        // Render activity list
        renderActivityList();
    }
    
    function renderCompletionChart() {
        const ctx = document.getElementById('completion-chart').getContext('2d');
        
        // Group completed tasks by day
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            last7Days.push(date.toISOString().split('T')[0]);
        }
        
        const completionsByDay = {};
        last7Days.forEach(day => {
            completionsByDay[day] = 0;
        });
        
        completedTasks.forEach(task => {
            const day = new Date(task.completedAt).toISOString().split('T')[0];
            if (completionsByDay[day] !== undefined) {
                completionsByDay[day]++;
            }
        });
        
        const chartData = {
            labels: last7Days.map(day => {
                const date = new Date(day);
                return date.toLocaleDateString('en-US', { weekday: 'short' });
            }),
            datasets: [{
                label: 'Tasks Completed',
                data: Object.values(completionsByDay),
                backgroundColor: '#f59e0b',
                borderColor: '#f59e0b',
                borderWidth: 1
            }]
        };
        
        // Destroy existing chart if it exists
        if (window.completionChart) {
            window.completionChart.destroy();
        }
        
        window.completionChart = new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: {
                responsive: true,
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    }
    
    function renderActivityList() {
        const activityList = document.getElementById('activity-list');
        
        // Clear existing items (except empty state)
        Array.from(activityList.children).forEach(child => {
            if (!child.classList.contains('empty-state')) {
                activityList.removeChild(child);
            }
        });
        
        // Add recent activities (latest first)
        const recentActivities = [...completedTasks].reverse().slice(0, 10);
        
        recentActivities.forEach(activity => {
            const date = new Date(activity.completedAt);
            const activityElement = document.createElement('div');
            activityElement.className = 'activity-item';
            activityElement.innerHTML = `
                <div class="task-title">${activity.name}</div>
                <div class="activity-date">Completed on ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}</div>
            `;
            
            activityList.appendChild(activityElement);
        });
    }
    
    // Storage functions
    function saveTasksToStorage() {
        localStorage.setItem('taskflow_tasks', JSON.stringify(tasks));
    }
    
    function loadTasksFromStorage() {
        const storedTasks = localStorage.getItem('taskflow_tasks');
        return storedTasks ? JSON.parse(storedTasks) : [];
    }
    
    function saveCompletedTasksToStorage() {
        localStorage.setItem('taskflow_completed', JSON.stringify(completedTasks));
    }
    
    function loadCompletedTasksFromStorage() {
        const storedTasks = localStorage.getItem('taskflow_completed');
        return storedTasks ? JSON.parse(storedTasks) : [];
    }
    
    // Event listeners
    function setupEventListeners() {
        // Navigation events
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const screenName = item.querySelector('span')?.textContent.toLowerCase();
                if (screenName && screenName !== currentScreen) {
                    if (screenName === 'home' || screenName === 'stats') {
                        showScreen(screenName);
                    }
                }
            });
        });
        
        // Add button click
        addButton.addEventListener('click', () => {
            // Reset form
            taskForm.name.value = '';
            taskForm.description.value = '';
            taskForm.toggleOptions[0].classList.add('active');
            taskForm.toggleOptions[1].classList.remove('active');
            taskForm.recurringOptions.classList.add('hidden');
            taskForm.days.forEach(day => day.classList.remove('selected'));
            document.getElementById('add-edit-title').textContent = 'Add New Task';
            taskForm.saveButton.dataset.mode = 'add';
            delete taskForm.saveButton.dataset.index;
            
            showScreen('addTask');
        });
        
        // Back buttons
        backButtons.forEach(button => {
            button.addEventListener('click', navigateBack);
        });
        
        // Task card clicks
        document.getElementById('task-list').addEventListener('click', (e) => {
            const taskCard = e.target.closest('.task-card');
            if (!taskCard) return;
            
            const index = parseInt(taskCard.dataset.index);
            
            // If checkbox was clicked, toggle completion
            if (e.target.closest('.task-checkbox')) {
                toggleTaskCompletion(index);
            } else {
                // Otherwise, show task details
                showTaskDetails(index);
            }
        });
        
        // Task action buttons in details view
        document.querySelector('.action-icons .fa-edit').addEventListener('click', () => {
            const index = parseInt(document.querySelector('#task-details-screen').dataset.taskIndex);
            prepareEditTask(index);
        });
        
        document.querySelector('.action-icons .fa-trash').addEventListener('click', () => {
            const index = parseInt(document.querySelector('#task-details-screen').dataset.taskIndex);
            
            tg.showPopup({
                title: 'Delete Task',
                message: 'Are you sure you want to delete this task?',
                buttons: [
                    {type: 'cancel'},
                    {
                        type: 'destructive',
                        text: 'Delete',
                        id: 'delete'
                    }
                ]
            }, (buttonId) => {
                if (buttonId === 'delete') {
                    deleteTask(index);
                }
            });
        });
        
        // Task form events
        taskForm.toggleOptions.forEach(option => {
            option.addEventListener('click', () => {
                taskForm.toggleOptions.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                
                // Show/hide recurring options
                taskForm.recurringOptions.classList.toggle('hidden', option.dataset.value !== 'recurring');
            });
        });
        
        taskForm.days.forEach(day => {
            day.addEventListener('click', () => {
                day.classList.toggle('selected');
            });
        });
        
        taskForm.saveButton.addEventListener('click', () => {
            const mode = taskForm.saveButton.dataset.mode || 'add';
            
            const task = createTask();
            if (!task) return; // Validation failed
            
            if (mode === 'edit') {
                const index = parseInt(taskForm.saveButton.dataset.index);
                tasks[index] = task;
            } else {
                tasks.push(task);
            }
            
            saveTasksToStorage();
            renderTasks();
            navigateBack();
            
            // Show success message
            tg.showPopup({
                title: 'Success',
                message: mode === 'edit' ? 'Task updated successfully' : 'Task added successfully',
                buttons: [{type: 'ok'}]
            });
        });
        
        taskForm.cancelButton.addEventListener('click', navigateBack);
        
        // Add this to your setupEventListeners function or wherever appropriate
        document.getElementById('view-dashboard').addEventListener('click', () => {
            if (currentUserRole === 'director') {
                showScreen('directorDashboard');
                document.querySelector('.user-menu').classList.add('hidden');
            }
        });
        
        // Modify the updateUIForRole function to also handle the dashboard menu item
        function updateUIForRole(role) {
            document.getElementById('user-role').textContent = `Role: ${role.charAt(0).toUpperCase() + role.slice(1)}`;
            
            // Update body class for CSS targeting
            document.body.classList.toggle('director-mode', role === 'director');
            
            // Show/hide director-only elements
            const directorElements = document.querySelectorAll('.director-only');
            directorElements.forEach(el => {
                el.classList.toggle('hidden', role !== 'director');
            });
            
            // Save role to storage
            localStorage.setItem('user_role', role);
            
            // Update profile icon to indicate director role if applicable
            const profileIcon = document.querySelector('.profile-icon i');
            if (role === 'director') {
                profileIcon.className = 'fas fa-user-tie';
            } else {
                profileIcon.className = 'fas fa-user';
            }
        }
        
        // Add this to make the profile icon clickable to show the menu
        document.querySelector('.profile-icon').addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelector('.user-menu').classList.toggle('hidden');
        });
        
        // Close the menu when clicking elsewhere
        document.addEventListener('click', () => {
            document.querySelector('.user-menu').classList.add('hidden');
        });
        
        // Add this to your setupEventListeners function
        document.getElementById('switch-role').addEventListener('click', () => {
            // Toggle between 'director' and 'subordinate' roles
            const newRole = currentUserRole === 'director' ? 'subordinate' : 'director';
            currentUserRole = newRole;
            updateUIForRole(newRole);
            
            // Close the menu
            document.querySelector('.user-menu').classList.add('hidden');
            
            // Show confirmation toast
            tg.showPopup({
                title: 'Role Changed',
                message: `You are now in ${newRole.charAt(0).toUpperCase() + newRole.slice(1)} mode.`,
                buttons: [{type: 'ok'}]
            });
        });
        
        // Add this to your setupEventListeners function
        document.getElementById('invite-users').addEventListener('click', () => {
            // Create the invite link using the Telegram Web App API
            const appLink = `https://t.me/${tg.initDataUnsafe.user.username || 'your_bot_name'}?start=invite`;
            
            // Use Telegram's native sharing
            tg.showPopup({
                title: 'Invite Users',
                message: 'Share this app with your colleagues:',
                buttons: [
                    {type: 'cancel'},
                    {
                        type: 'default',
                        text: 'Copy Link',
                        id: 'copy'
                    },
                    {
                        type: 'default',
                        text: 'Share',
                        id: 'share'
                    }
                ]
            }, (buttonId) => {
                if (buttonId === 'copy') {
                    // Copy to clipboard functionality
                    navigator.clipboard.writeText(appLink).then(() => {
                        tg.showAlert('Link copied to clipboard!');
                    });
                } else if (buttonId === 'share') {
                    // Use Telegram's share feature
                    tg.shareUrl(appLink);
                }
            });
            
            // Close the menu
            document.querySelector('.user-menu').classList.add('hidden');
        });
        
        // Add to your setupEventListeners function
        setupAssigneeSearch();
    }
    
    // Add to your setupEventListeners function
    function setupAssigneeSearch() {
        const searchInput = document.getElementById('assignee-search');
        const resultsContainer = document.getElementById('assignee-results');
        const selectedContainer = document.getElementById('selected-assignee');
        const selectedName = document.getElementById('assignee-name');
        const removeBtn = document.getElementById('remove-assignee');
        
        // Current selected assignee
        let selectedAssignee = null;
        
        // Show/hide results based on input
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.length > 0 || subordinates.length > 0) {
                resultsContainer.classList.remove('hidden');
                populateAssigneeResults(searchInput.value);
            }
        });
        
        searchInput.addEventListener('input', () => {
            if (searchInput.value.length > 0 || subordinates.length > 0) {
                resultsContainer.classList.remove('hidden');
                populateAssigneeResults(searchInput.value);
            } else {
                resultsContainer.classList.add('hidden');
            }
        });
        
        // Hide results when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.assignee-search')) {
                resultsContainer.classList.add('hidden');
            }
        });
        
        // Handle selection
        resultsContainer.addEventListener('click', (e) => {
            const option = e.target.closest('.assignee-option');
            if (option) {
                const id = parseInt(option.dataset.id);
                const sub = subordinates.find(s => s.id === id);
                if (sub) {
                    selectAssignee(sub);
                    resultsContainer.classList.add('hidden');
                    searchInput.value = '';
                }
            }
        });
        
        // Handle removing selected assignee
        removeBtn.addEventListener('click', () => {
            selectedAssignee = null;
            selectedContainer.classList.add('hidden');
            searchInput.disabled = false;
        });
        
        // Function to populate results
        function populateAssigneeResults(query) {
            resultsContainer.innerHTML = '';
            
            const filteredSubs = subordinates.filter(sub => 
                sub.name.toLowerCase().includes(query.toLowerCase())
            );
            
            if (filteredSubs.length === 0) {
                const noResults = document.createElement('div');
                noResults.className = 'assignee-option';
                noResults.textContent = 'No users found';
                resultsContainer.appendChild(noResults);
                return;
            }
            
            filteredSubs.forEach(sub => {
                const option = document.createElement('div');
                option.className = 'assignee-option';
                option.dataset.id = sub.id;
                option.innerHTML = `
                    <div class="subordinate-avatar">${sub.initials}</div>
                    <span>${sub.name}</span>
                `;
                resultsContainer.appendChild(option);
            });
        }
        
        // Function to select an assignee
        function selectAssignee(sub) {
            selectedAssignee = sub;
            selectedName.textContent = sub.name;
            selectedContainer.classList.remove('hidden');
            searchInput.disabled = true;
            
            // Store the selected assignee ID in a hidden input
            if (!document.getElementById('hidden-assignee-id')) {
                const hiddenInput = document.createElement('input');
                hiddenInput.type = 'hidden';
                hiddenInput.id = 'hidden-assignee-id';
                document.getElementById('assign-task-group').appendChild(hiddenInput);
            }
            document.getElementById('hidden-assignee-id').value = sub.id;
        }
    }
}

// Create the app.js file if it doesn't exist
function createAppJsFile() {
    // Check if app.js exists, if not create it
    fetch('js/app.js')
        .then(response => {
            if (!response.ok) {
                // Create the file with basic content
                const appJsContent = `// TaskFlow App
// This file is automatically generated

// Main entry point for app-specific logic
document.addEventListener('DOMContentLoaded', function() {
    console.log('TaskFlow app is ready!');
    
    // This file can be used for app-specific functionality
    // that's separate from the Telegram integration
});
`;
                
                // Log the content for the user to create manually if needed
                console.log('Please create js/app.js file with the following content:');
                console.log(appJsContent);
            }
        })
        .catch(error => {
            console.error('Error checking app.js:', error);
        });
}

// Execute when script loads
createAppJsFile();

// Function to mark a task as completed
function markTaskAsCompleted(index) {
    tasks[index].completed = true;
    tasks[index].completedAt = new Date().toISOString();
    completedTasks.push(tasks[index]);
    tasks.splice(index, 1); // Remove the task from the active list

    saveTasksToStorage();
    renderTasks();

    // Show success message
    tg.showPopup({
        title: 'Task Completed',
        message: 'The task has been marked as completed.',
        buttons: [{type: 'ok'}]
    });

    // Navigate back to the home screen
    showScreen('home');
}

// Event listener for the complete task button
document.getElementById('complete-task').addEventListener('click', () => {
    const index = parseInt(document.querySelector('#task-details-screen').dataset.taskIndex);
    markTaskAsCompleted(index);
});
