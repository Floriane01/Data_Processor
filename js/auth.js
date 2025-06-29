
        let users = [];

        function loadUsers() {
            const savedUsers = localStorage.getItem('dataprocessor_users');
            if (savedUsers) {
                users = JSON.parse(savedUsers);
            }
        }

        function saveUsers() {
            localStorage.setItem('dataprocessor_users', JSON.stringify(users));
        }

        function showMessage(message, type = 'success') {
            const container = document.getElementById('messageContainer');
            const messageEl = document.createElement('div');
            messageEl.className = `message ${type}`;
            
            const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
            messageEl.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
            
            container.innerHTML = '';
            container.appendChild(messageEl);
            
            setTimeout(() => {
                messageEl.remove();
            }, 5000);
        }

        function togglePassword(inputId) {
            const input = document.getElementById(inputId);
            const icon = input.nextElementSibling.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        }

        function showRegister() {
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('registerForm').classList.remove('hidden');
            document.getElementById('authDescription').textContent = 'Créez votre compte étudiant';
            document.getElementById('messageContainer').innerHTML = '';
        }

        function showLogin() {
            document.getElementById('registerForm').classList.add('hidden');
            document.getElementById('loginForm').classList.remove('hidden');
            document.getElementById('authDescription').textContent = 'Connectez-vous à votre compte étudiant';
            document.getElementById('messageContainer').innerHTML = '';
        }

        function isValidEmail(email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        }

        function isValidPassword(password) {
            return password.length >= 6;
        }

        function generateUserId() {
            return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }

        function hashPassword(password) {
            return btoa(password + 'salt_key_2024');
        }

        function verifyPassword(password, hashedPassword) {
            return hashPassword(password) === hashedPassword;
        }

        document.getElementById('registerForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.classList.add('loading');
            
            setTimeout(() => {
                const firstName = document.getElementById('firstName').value.trim();
                const lastName = document.getElementById('lastName').value.trim();
                const email = document.getElementById('regEmail').value.trim().toLowerCase();
                const password = document.getElementById('regPassword').value;
                const confirmPassword = document.getElementById('confirmPassword').value;

                if (!firstName || !lastName) {
                    showMessage('Veuillez remplir tous les champs nom et prénom.', 'error');
                    submitBtn.classList.remove('loading');
                    return;
                }

                if (!isValidEmail(email)) {
                    showMessage('Veuillez entrer une adresse email valide.', 'error');
                    submitBtn.classList.remove('loading');
                    return;
                }

                if (!isValidPassword(password)) {
                    showMessage('Le mot de passe doit contenir au moins 6 caractères.', 'error');
                    submitBtn.classList.remove('loading');
                    return;
                }

                if (password !== confirmPassword) {
                    showMessage('Les mots de passe ne correspondent pas.', 'error');
                    submitBtn.classList.remove('loading');
                    return;
                }

                if (users.find(user => user.email === email)) {
                    showMessage('Cette adresse email est déjà utilisée.', 'error');
                    submitBtn.classList.remove('loading');
                    return;
                }


                const newUser = {
                    id: generateUserId(),
                    firstName: firstName,
                    lastName: lastName,
                    email: email,
                    password: hashPassword(password),
                    createdAt: new Date().toISOString(),
                };

                users.push(newUser);
                saveUsers();

                showMessage('Compte créé avec succès ! Redirection vers le tableau de bord...', 'success');

                localStorage.setItem('dataprocessor_current_user', JSON.stringify({
                    id: newUser.id,
                    firstName: newUser.firstName,
                    lastName: newUser.lastName,
                    email: newUser.email,
                }));

                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 2000);

                submitBtn.classList.remove('loading');
            }, 1000);
        });

        document.getElementById('loginForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.classList.add('loading');
            
            setTimeout(() => {
                const email = document.getElementById('email').value.trim().toLowerCase();
                const password = document.getElementById('password').value;
                const remember = document.getElementById('remember').checked;

                if (!isValidEmail(email)) {
                    showMessage('Veuillez entrer une adresse email valide.', 'error');
                    submitBtn.classList.remove('loading');
                    return;
                }

                if (!password) {
                    showMessage('Veuillez entrer votre mot de passe.', 'error');
                    submitBtn.classList.remove('loading');
                    return;
                }

                const user = users.find(u => u.email === email);
                
                if (!user) {
                    showMessage('Aucun compte trouvé avec cette adresse email.', 'error');
                    submitBtn.classList.remove('loading');
                    return;
                }

                if (!verifyPassword(password, user.password)) {
                    showMessage('Mot de passe incorrect.', 'error');
                    submitBtn.classList.remove('loading');
                    return;
                }

                user.lastLogin = new Date().toISOString();
                saveUsers();

                showMessage('Connexion réussie ! Redirection vers le tableau de bord...', 'success');

                const userData = {
                    id: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                };

                if (remember) {
                    localStorage.setItem('dataprocessor_remember_user', JSON.stringify(userData));
                }

                localStorage.setItem('dataprocessor_current_user', JSON.stringify(userData));

                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 2000);

                submitBtn.classList.remove('loading');
            }, 1000);
        });

        loadUsers();

        const currentUser = localStorage.getItem('dataprocessor_current_user');
        if (currentUser) {
            window.location.href = 'dashboard.html';
        }

        const rememberedUser = localStorage.getItem('dataprocessor_remember_user');
        if (rememberedUser) {
            const userData = JSON.parse(rememberedUser);
            document.getElementById('email').value = userData.email;
            document.getElementById('remember').checked = true;
        }

        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => {
                document.querySelector('.auth-card').style.opacity = '1';
                document.querySelector('.auth-card').style.transform = 'translateY(0)';
            }, 100);
        });

        document.querySelector('.auth-card').style.opacity = '0';
        document.querySelector('.auth-card').style.transform = 'translateY(20px)';
        document.querySelector('.auth-card').style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    