// 全局变量
let currentHTML = '';
let currentMarkdown = '';
let turndownService = null;

// DOM元素
const selectElementBtn = document.getElementById('selectElement');
const selectMainBtn = document.getElementById('selectMain');
const downloadMarkdownBtn = document.getElementById('downloadMarkdown');
const previewContainer = document.getElementById('previewContainer');
const markdownPreview = document.getElementById('markdownPreview');
const openOptionsBtn = document.getElementById('openOptions');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 加载TurndownService
  loadTurndownService();
  
  // 添加事件监听器
  setupEventListeners();
  
  // 检查当前标签页是否可以使用插件
  checkCurrentTab();
  
  // 检查是否有之前选择的元素
  checkForSelectedElement();
});

// 加载TurndownService
function loadTurndownService() {
  // 直接初始化TurndownService
  // 因为我们已经在popup.html中引入了turndown.js
  setTimeout(initializeTurndownService, 100);
}

// 初始化TurndownService
function initializeTurndownService() {
  try {
    // 确保TurndownService类已定义
    if (typeof TurndownService === 'function') {
      turndownService = new TurndownService({
        headingStyle: 'atx',
        hr: '---',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        emDelimiter: '*'
      });
      
      // 自定义规则，保留更多原始格式
      turndownService.addRule('preserveTableStructure', {
        filter: 'table',
        replacement: function(content) {
          // 简单表格处理
          return '\n\n' + content + '\n\n';
        }
      });
    } else {
      console.error('TurndownService class not found');
      showError('转换服务加载失败，请刷新页面重试');
    }
  } catch (error) {
    console.error('Error initializing TurndownService:', error);
    showError('初始化转换服务失败: ' + error.message);
  }
}

// 设置事件监听器
function setupEventListeners() {
  // 选择元素按钮
  selectElementBtn.addEventListener('click', () => {
    showLoading('正在准备选择工具...');
    startElementSelection();
  });
  
  // 选择主要内容按钮
  selectMainBtn.addEventListener('click', () => {
    showLoading('正在提取文章内容...');
    getMainContent();
  });
  
  // 下载Markdown按钮
  downloadMarkdownBtn.addEventListener('click', () => {
    downloadMarkdown();
  });
  
  // 打开选项页按钮
  openOptionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // 监听来自content script和background的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'elementSelected' && request.success) {
      // 重新打开popup并获取选中的元素
      getSelectedElementHTML();
    } else if (request.action === 'downloadError') {
      // 处理下载错误
      hideLoading();
      showError('下载失败: ' + (request.error || '未知错误，请重试'));
    }
  });
}

// 检查当前标签页是否可以使用插件
function checkCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    
    // 检查是否是有效的网页
    if (!currentTab.url || currentTab.url.startsWith('chrome://') || currentTab.url.startsWith('chrome-extension://')) {
      disableAllButtons();
      showError('此页面不支持使用Page2md');
    }
  });
}

// 禁用所有按钮
function disableAllButtons() {
  selectElementBtn.disabled = true;
  selectMainBtn.disabled = true;
  downloadMarkdownBtn.disabled = true;
}

// 显示错误信息
function showError(message) {
  hideLoading();
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  
  // 使用innerHTML而不是textContent，以便支持HTML标签
  errorDiv.innerHTML = message;
  
  // 移除之前的错误信息
  const oldError = document.querySelector('.error');
  if (oldError) {
    oldError.remove();
  }
  
  document.querySelector('.container').appendChild(errorDiv);
}

// 显示加载中状态
function showLoading(message) {
  // 创建或更新加载提示
  let loadingDiv = document.querySelector('.loading');
  if (!loadingDiv) {
    loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    document.querySelector('.container').appendChild(loadingDiv);
  }
  
  loadingDiv.innerHTML = `
    <div class="spinner"></div>
    <div class="loading-text">${message || '处理中...'}</div>
  `;
  loadingDiv.style.display = 'flex';
}

// 隐藏加载中状态
function hideLoading() {
  const loadingDiv = document.querySelector('.loading');
  if (loadingDiv) {
    loadingDiv.style.display = 'none';
  }
}

// 开始元素选择
function startElementSelection() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    try {
      // 首先尝试注入内容脚本，确保它已加载
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['content.js']
      }, () => {
        // 即使脚本已经存在，这也不会导致问题
        // 现在发送消息
        try {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'startElementSelection' }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error:', chrome.runtime.lastError.message || '未知错误');
              showError('无法启动选择工具: ' + (chrome.runtime.lastError.message || '未知错误') + 
                        '<br>请尝试刷新页面或使用"一键提取文章"功能');
              return;
            }
            
            if (response && response.status === 'selection_started') {
              // 关闭popup以便用户选择元素
              window.close();
            } else {
              showError('启动选择工具失败，请尝试刷新页面');
            }
          });
        } catch (err) {
          console.error('发送消息错误:', err);
          showError('与页面通信失败: ' + err.message);
        }
      });
    } catch (err) {
      console.error('注入脚本错误:', err);
      showError('无法在当前页面使用选择工具: ' + err.message);
    }
  });
}

// 获取选中元素的HTML
function getSelectedElementHTML() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    try {
      // 确保内容脚本已加载
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['content.js']
      }, () => {
        try {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'getSelectedElementHTML' }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error:', chrome.runtime.lastError.message || '未知错误');
              showError('无法获取选中内容: ' + (chrome.runtime.lastError.message || '未知错误') + 
                        '<br>请尝试刷新页面后重新选择');
              hideLoading();
              return;
            }
            
            if (response && response.success) {
              currentHTML = response.html;
              // 自动转换为Markdown
              convertToMarkdown();
            } else {
              showError('未能获取选中内容，请重新选择');
              hideLoading();
            }
          });
        } catch (err) {
          console.error('发送消息错误:', err);
          showError('与页面通信失败: ' + err.message);
          hideLoading();
        }
      });
    } catch (err) {
      console.error('注入脚本错误:', err);
      showError('无法在当前页面获取内容: ' + err.message);
      hideLoading();
    }
  });
}

// 获取主要内容
function getMainContent() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    try {
      // 确保内容脚本已加载
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['content.js']
      }, () => {
        try {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'getMainContent' }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error:', chrome.runtime.lastError.message || '未知错误');
              showError('无法提取文章内容: ' + (chrome.runtime.lastError.message || '未知错误') + 
                        '<br>请尝试手动选择内容');
              hideLoading();
              return;
            }
            
            if (response && response.success) {
              currentHTML = response.html;
              // 自动转换为Markdown
              convertToMarkdown();
            } else {
              showError(response.message || '无法识别主要内容，请尝试手动选择');
              hideLoading();
            }
          });
        } catch (err) {
          console.error('发送消息错误:', err);
          showError('与页面通信失败: ' + err.message);
          hideLoading();
        }
      });
    } catch (err) {
      console.error('注入脚本错误:', err);
      showError('无法在当前页面提取内容: ' + err.message);
      hideLoading();
    }
  });
}

// 显示消息
function showMessage(message) {
  hideLoading();
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message';
  messageDiv.textContent = message;
  
  // 移除之前的消息
  const oldMessage = document.querySelector('.message');
  if (oldMessage) {
    oldMessage.remove();
  }
  
  document.querySelector('.container').appendChild(messageDiv);
  
  // 3秒后自动移除
  setTimeout(() => {
    messageDiv.remove();
  }, 3000);
}

// 转换为Markdown
function convertToMarkdown() {
  if (!currentHTML || !turndownService) {
    showError('无内容可转换或转换服务未加载');
    return;
  }
  
  showLoading('正在转换为Markdown...');
  
  try {
    // 创建临时DOM元素来解析HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = currentHTML;
    
    // 清理HTML（移除脚本和样式）
    const scripts = tempDiv.querySelectorAll('script, style');
    scripts.forEach(script => script.remove());
    
    // 转换为Markdown
    currentMarkdown = turndownService.turndown(tempDiv.innerHTML);
    
    // 显示预览
    showMarkdownPreview();
    
    // 启用下载按钮
    downloadMarkdownBtn.disabled = false;
    hideLoading();
    showMessage('转换完成，可以下载了');
  } catch (error) {
    console.error('转换错误:', error);
    showError('转换过程中出错: ' + error.message);
  }
}

// 显示Markdown预览
function showMarkdownPreview() {
  if (!currentMarkdown) return;
  
  // 显示预览容器
  previewContainer.classList.remove('hidden');
  
  // 设置预览内容（转义HTML标签）
  markdownPreview.textContent = currentMarkdown.substring(0, 1000);
  
  // 如果内容被截断，显示提示
  if (currentMarkdown.length > 1000) {
    markdownPreview.textContent += '\n\n... (内容已截断，完整内容将在下载后显示)';
  }
}

// 下载Markdown
function downloadMarkdown() {
  if (!currentMarkdown) {
    showError('没有可下载的内容');
    return;
  }
  
  showLoading('准备下载...');
  
  try {
    // 直接使用备用方法，显示内容供用户复制
    // 这是最可靠的方法，不依赖于浏览器的下载API
    showCopyableContent();
  } catch (error) {
    console.error('下载过程中出错:', error);
    hideLoading();
    showError('下载过程中出错: ' + error.message);
  }
}

// 显示可复制的内容
function showCopyableContent() {
  hideLoading();
  
  // 移除之前的文本区域和按钮（如果有）
  const existingTextArea = document.getElementById('markdown-content');
  const existingCopyButton = document.getElementById('copy-button');
  const existingSaveButton = document.getElementById('save-button');
  
  if (existingTextArea) existingTextArea.remove();
  if (existingCopyButton) existingCopyButton.remove();
  if (existingSaveButton) existingSaveButton.remove();
  
  // 创建一个文本区域显示Markdown内容
  const textArea = document.createElement('textarea');
  textArea.id = 'markdown-content';
  textArea.value = currentMarkdown;
  textArea.style.width = '100%';
  textArea.style.height = '200px';
  textArea.style.marginTop = '10px';
  textArea.style.padding = '8px';
  textArea.style.border = '1px solid #ddd';
  textArea.style.borderRadius = '4px';
  textArea.style.fontFamily = 'monospace';
  textArea.style.fontSize = '12px';
  
  // 创建复制按钮
  const copyButton = document.createElement('button');
  copyButton.id = 'copy-button';
  copyButton.textContent = '复制内容';
  copyButton.className = 'btn primary';
  copyButton.style.marginTop = '10px';
  copyButton.style.width = '100%';
  
  // 添加复制功能
  copyButton.addEventListener('click', () => {
    textArea.select();
    document.execCommand('copy');
    showMessage('内容已复制到剪贴板');
  });
  
  // 创建保存按钮（尝试另一种下载方法）
  const saveButton = document.createElement('button');
  saveButton.id = 'save-button';
  saveButton.textContent = '尝试另一种下载方式';
  saveButton.className = 'btn';
  saveButton.style.marginTop = '10px';
  saveButton.style.width = '100%';
  
  // 添加保存功能
  saveButton.addEventListener('click', () => {
    tryDirectDownload();
  });
  
  // 添加到页面
  const container = document.querySelector('.container');
  container.appendChild(textArea);
  container.appendChild(copyButton);
  container.appendChild(saveButton);
  
  // 自动选择文本
  textArea.select();
  
  // 显示提示
  showMessage('请复制内容或尝试另一种下载方式');
}

// 尝试直接下载
function tryDirectDownload() {
  try {
    // 获取当前页面标题作为文件名
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const title = tabs[0].title || 'page2md';
      const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_').substring(0, 50);
      const filename = `${safeTitle}.md`;
      
      // 使用数据URI方式下载
      const dataUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(currentMarkdown);
      
      // 创建一个临时链接
      const link = document.createElement('a');
      link.href = dataUri;
      link.download = filename;
      link.style.display = 'none';
      
      // 添加到页面并点击
      document.body.appendChild(link);
      
      // 显示提示，让用户知道下载即将开始
      showMessage('准备下载，请稍候...');
      
      // 延迟一点时间再点击，确保UI更新
      setTimeout(() => {
        link.click();
        
        // 清理
        setTimeout(() => {
          document.body.removeChild(link);
          showMessage('如果下载未开始，请点击"复制内容"按钮');
        }, 1000);
      }, 500);
    });
  } catch (error) {
    console.error('直接下载失败:', error);
    showError('下载失败，请使用复制功能');
  }
}

// 备用下载方法
function fallbackDownload() {
  try {
    const filename = 'page2md_backup.md';
    
    // 使用文本区域和复制功能
    showMessage('请手动保存内容');
    
    // 创建一个文本区域显示Markdown内容
    const textArea = document.createElement('textarea');
    textArea.value = currentMarkdown;
    textArea.style.width = '100%';
    textArea.style.height = '200px';
    textArea.style.marginTop = '10px';
    textArea.style.padding = '8px';
    textArea.style.border = '1px solid #ddd';
    textArea.style.borderRadius = '4px';
    textArea.style.fontFamily = 'monospace';
    textArea.style.fontSize = '12px';
    
    // 添加复制按钮
    const copyButton = document.createElement('button');
    copyButton.textContent = '复制内容';
    copyButton.className = 'btn primary';
    copyButton.style.marginTop = '10px';
    copyButton.style.width = '100%';
    
    copyButton.addEventListener('click', () => {
      textArea.select();
      document.execCommand('copy');
      showMessage('内容已复制到剪贴板');
    });
    
    // 添加到页面
    const container = document.querySelector('.container');
    container.appendChild(textArea);
    container.appendChild(copyButton);
    
    // 自动选择文本
    textArea.select();
    
    hideLoading();
  } catch (error) {
    console.error('备用下载方法失败:', error);
    hideLoading();
    showError('无法下载，请尝试刷新页面');
  }
}

// 检查是否有之前选择的元素
function checkForSelectedElement() {
  chrome.storage.local.get(['elementSelected'], (result) => {
    if (result.elementSelected) {
      // 清除标记，避免重复处理
      chrome.storage.local.remove(['elementSelected']);
      
      // 显示加载状态
      showLoading('正在获取选中内容...');
      
      // 延迟一点时间确保content script已准备好
      setTimeout(() => {
        getSelectedElementHTML();
      }, 300);
    }
  });
}