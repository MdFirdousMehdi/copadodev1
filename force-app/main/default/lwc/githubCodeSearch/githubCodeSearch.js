import { LightningElement, track } from 'lwc';
import searchGitHubCode from '@salesforce/apex/GitHubSearchController.searchGitHubCode';

export default class GithubCodeSearch extends LightningElement {
    @track searchTerm = '';
    @track repository = '';
    @track searchResults = [];
    @track isLoading = false;
    @track errorMessage = '';
    @track totalCount = 0;

    // File type mapping based on extension or path
    fileTypeMap = {
        '.cls': 'Apex Class',
        '.trigger': 'Apex Trigger',
        '.component': 'Visualforce Component',
        '.page': 'Visualforce Page',
        '.object': 'Custom Object',
        '.field-meta.xml': 'Custom Field',
        '.workflow': 'Workflow Rule',
        '.flow': 'Flow',
        '.permissionset': 'Permission Set',
        '.profile': 'Profile',
        '.layout': 'Page Layout',
        '.app': 'Lightning App',
        '.cmp': 'Aura Component',
        '.js': 'JavaScript',
        '.html': 'HTML',
        '.css': 'CSS',
        '.xml': 'XML'
    };

    get isSearchDisabled() {
        return !this.searchTerm || !this.repository || this.isLoading;
    }

    get showResults() {
        return !this.isLoading && this.searchResults.length > 0;
    }

    get showNoResults() {
        return !this.isLoading && this.searchResults.length === 0 && this.totalCount === 0 && !this.errorMessage && this.searchTerm;
    }

    get resultText() {
        return this.totalCount === 1 ? 'result' : 'results';
    }

    handleSearchTermChange(event) {
        this.searchTerm = event.target.value;
    }

    handleRepositoryChange(event) {
        this.repository = event.target.value;
    }

    handleSearch() {
        if (!this.searchTerm || !this.repository) {
            this.errorMessage = 'Please enter both search term and repository.';
            return;
        }

        this.isLoading = true;
        this.errorMessage = '';
        this.searchResults = [];

        searchGitHubCode({
            searchTerm: this.searchTerm,
            repository: this.repository
        })
            .then(result => {
                const data = JSON.parse(result);
                this.totalCount = data.total_count;
                
                if (data.items && data.items.length > 0) {
                    this.searchResults = data.items.map(item => {
                        return {
                            sha: item.sha,
                            name: item.name,
                            path: item.path,
                            html_url: item.html_url,
                            repoName: item.repository.full_name,
                            repoUrl: item.repository.html_url,
                            owner: item.repository.owner.login,
                            ownerUrl: item.repository.owner.html_url,
                            fileType: this.determineFileType(item.name, item.path),
                            badgeClass: this.getBadgeClass(item.name, item.path)
                        };
                    });
                } else {
                    this.searchResults = [];
                }
            })
            .catch(error => {
                this.errorMessage = error.body ? error.body.message : 'An error occurred while searching GitHub.';
                console.error('Error searching GitHub:', error);
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    handleClear() {
        this.searchTerm = '';
        this.repository = '';
        this.searchResults = [];
        this.errorMessage = '';
        this.totalCount = 0;
    }

    determineFileType(fileName, filePath) {
        // Check for specific Salesforce metadata patterns in path
        if (filePath.includes('/fields/') && fileName.endsWith('.field-meta.xml')) {
            return 'Custom Field';
        }
        if (filePath.includes('/objects/') && fileName.endsWith('.object-meta.xml')) {
            return 'Custom Object';
        }
        if (filePath.includes('/triggers/')) {
            return 'Apex Trigger';
        }
        if (filePath.includes('/classes/')) {
            return 'Apex Class';
        }
        if (filePath.includes('/pages/')) {
            return 'Visualforce Page';
        }
        if (filePath.includes('/components/')) {
            return 'Visualforce Component';
        }
        if (filePath.includes('/aura/')) {
            return 'Aura Component';
        }
        if (filePath.includes('/lwc/')) {
            return 'LWC Component';
        }
        if (filePath.includes('/flows/')) {
            return 'Flow';
        }
        if (filePath.includes('/workflows/')) {
            return 'Workflow Rule';
        }
        if (filePath.includes('/layouts/')) {
            return 'Page Layout';
        }
        if (filePath.includes('/permissionsets/')) {
            return 'Permission Set';
        }
        if (filePath.includes('/profiles/')) {
            return 'Profile';
        }

        // Check file extension
        for (const [extension, type] of Object.entries(this.fileTypeMap)) {
            if (fileName.endsWith(extension)) {
                return type;
            }
        }

        // Default to file extension if no match
        const parts = fileName.split('.');
        return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : 'Unknown';
    }

    getBadgeClass(fileName, filePath) {
        const fileType = this.determineFileType(fileName, filePath);
        
        // Return different badge classes based on file type
        if (fileType.includes('Apex') || fileType.includes('Trigger')) {
            return 'badge-apex';
        } else if (fileType.includes('Field') || fileType.includes('Object')) {
            return 'badge-field';
        } else if (fileType.includes('LWC') || fileType.includes('Aura') || fileType.includes('Component')) {
            return 'badge-component';
        } else if (fileType.includes('Flow') || fileType.includes('Workflow')) {
            return 'badge-flow';
        }
        
        return 'badge-default';
    }
}