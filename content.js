// 全局变量 - 使用 var 而不是 let 来避免重复声明错误
// 如果变量已经存在，这将不会重新声明它们
var isSelectionMode = false;
var selectedElement = null;
var highlightOverlay = null;

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'startElementSelection':
      startElementSelection();
      sendResponse({ status: 'selection_started' });
      break;
      
    case 'getSelectedElementHTML':
      if (selectedElement) {
        sendResponse({ 
          html: selectedElement.outerHTML,
          success: true 
        });
      } else {
        sendResponse({ 
          success: false, 
          message: '未选择任何元素' 
        });
      }
      break;
      
    case 'getElementBySelector':
      try {
        const elements = document.querySelectorAll(request.selector);
        if (elements.length === 0) {
          sendResponse({ 
            success: false, 
            message: '未找到匹配的元素' 
          });
        } else {
          // 如果找到多个元素，将它们包装在一个div中
          let html = '';
          elements.forEach(el => {
            html += el.outerHTML;
          });
          
          sendResponse({ 
            html: html,
            count: elements.length,
            success: true 
          });
        }
      } catch (error) {
        sendResponse({ 
          success: false, 
          message: '选择器语法错误: ' + error.message 
        });
      }
      break;
      
    case 'getMainContent':
      const mainContent = extractMainContent();
      if (mainContent) {
        sendResponse({ 
          html: mainContent.outerHTML,
          success: true 
        });
      } else {
        sendResponse({ 
          success: false, 
          message: '无法确定主要内容' 
        });
      }
      break;
      
    case 'showNotification':
      // 显示通知，提示用户点击扩展图标
      showSelectionToast(request.message || '内容已选中，请点击扩展图标查看结果');
      sendResponse({ success: true });
      break;
  }
  
  return true; // 保持消息通道开放，以便异步响应
});

// 开始元素选择模式
function startElementSelection() {
  if (isSelectionMode) return;
  
  isSelectionMode = true;
  selectedElement = null;
  
  // 创建高亮覆盖层
  createHighlightOverlay();
  
  // 添加鼠标移动事件监听器
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('click', handleElementClick);
  
  // 修改光标样式
  document.body.style.cursor = 'crosshair';
}

// 创建高亮覆盖层
function createHighlightOverlay() {
  highlightOverlay = document.createElement('div');
  highlightOverlay.style.position = 'fixed';
  highlightOverlay.style.pointerEvents = 'none';
  highlightOverlay.style.border = '2px solid #4285f4';
  highlightOverlay.style.backgroundColor = 'rgba(66, 133, 244, 0.2)';
  highlightOverlay.style.zIndex = '2147483647';
  highlightOverlay.style.display = 'none';
  document.body.appendChild(highlightOverlay);
}

// 处理鼠标移动
function handleMouseMove(event) {
  if (!isSelectionMode) return;
  
  // 获取鼠标下的元素
  const element = document.elementFromPoint(event.clientX, event.clientY);
  if (!element) return;
  
  // 更新高亮覆盖层位置
  const rect = element.getBoundingClientRect();
  highlightOverlay.style.display = 'block';
  highlightOverlay.style.top = rect.top + 'px';
  highlightOverlay.style.left = rect.left + 'px';
  highlightOverlay.style.width = rect.width + 'px';
  highlightOverlay.style.height = rect.height + 'px';
}

// 处理元素点击
function handleElementClick(event) {
  if (!isSelectionMode) return;
  
  // 阻止默认点击行为
  event.preventDefault();
  event.stopPropagation();
  
  // 获取点击的元素
  selectedElement = document.elementFromPoint(event.clientX, event.clientY);
  
  // 高亮选中的元素
  if (selectedElement) {
    // 添加选中样式
    selectedElement.classList.add('page2md-selected');
    
    // 显示选中成功的提示
    showSelectionToast('内容已选中！请点击浏览器工具栏中的Page2md图标查看结果');
    
    // 创建一个悬浮按钮，点击后可以直接打开popup
    createFloatingButton();
  }
  
  // 结束选择模式
  endSelectionMode();
  
  // 通知background已选择元素
  chrome.runtime.sendMessage({
    action: 'elementSelected',
    success: true
  });
  
  return false;
}

// 结束选择模式
function endSelectionMode() {
  isSelectionMode = false;
  
  // 移除事件监听器
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('click', handleElementClick);
  
  // 恢复光标样式
  document.body.style.cursor = '';
  
  // 移除高亮覆盖层
  if (highlightOverlay) {
    highlightOverlay.remove();
    highlightOverlay = null;
  }
}

// 提取主要内容
function extractMainContent() {
  // 尝试查找常见的主内容容器
  const selectors = [
    'article',
    'main',
    '.article',
    '.post',
    '.content',
    '.main-content',
    '#content',
    '#main',
    '.article-content',
    '.post-content'
  ];
  
  // 尝试每个选择器
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      // 找到最大的那个元素（通常是主内容）
      let largestElement = elements[0];
      let maxSize = getElementSize(largestElement);
      
      for (let i = 1; i < elements.length; i++) {
        const size = getElementSize(elements[i]);
        if (size > maxSize) {
          maxSize = size;
          largestElement = elements[i];
        }
      }
      
      return largestElement;
    }
  }
  
  // 如果没有找到，尝试使用启发式方法
  return findLargestTextBlock();
}

// 获取元素的大小（用于比较）
function getElementSize(element) {
  const text = element.textContent || '';
  return text.length;
}

// 查找最大的文本块
function findLargestTextBlock() {
  // 获取所有可能的内容块
  const contentBlocks = document.querySelectorAll('div, section');
  
  let largestBlock = null;
  let maxTextLength = 0;
  
  contentBlocks.forEach(block => {
    // 忽略导航、页脚等
    if (isNavigationOrFooter(block)) return;
    
    const textLength = block.textContent.length;
    if (textLength > maxTextLength) {
      maxTextLength = textLength;
      largestBlock = block;
    }
  });
  
  return largestBlock;
}

// 检查元素是否可能是导航或页脚
function isNavigationOrFooter(element) {
  const tagName = element.tagName.toLowerCase();
  const className = (element.className || '').toLowerCase();
  const id = (element.id || '').toLowerCase();
  
  return (
    tagName === 'nav' ||
    tagName === 'footer' ||
    tagName === 'header' ||
    className.includes('nav') ||
    className.includes('menu') ||
    className.includes('footer') ||
    className.includes('header') ||
    id.includes('nav') ||
    id.includes('menu') ||
    id.includes('footer') ||
    id.includes('header')
  );
}

// 显示选择提示
function showSelectionToast(message) {
  // 创建提示元素
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.bottom = '20px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  toast.style.color = 'white';
  toast.style.padding = '10px 20px';
  toast.style.borderRadius = '4px';
  toast.style.zIndex = '2147483647';
  toast.style.fontSize = '14px';
  toast.style.fontFamily = 'Arial, sans-serif';
  toast.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
  
  // 添加到页面
  document.body.appendChild(toast);
  
  // 3秒后自动移除
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s';
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

// 创建悬浮按钮
function createFloatingButton() {
  // 移除已存在的按钮（如果有）
  const existingButton = document.getElementById('page2md-floating-button');
  if (existingButton) {
    existingButton.remove();
  }
  
  // 创建按钮容器
  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'page2md-floating-button';
  buttonContainer.style.position = 'fixed';
  buttonContainer.style.right = '20px';
  buttonContainer.style.top = '20px';
  buttonContainer.style.zIndex = '2147483647';
  buttonContainer.style.display = 'flex';
  buttonContainer.style.flexDirection = 'column';
  buttonContainer.style.gap = '10px';
  
  // 创建转换按钮
  const convertButton = document.createElement('button');
  convertButton.textContent = '转换为Markdown';
  convertButton.style.padding = '8px 16px';
  convertButton.style.backgroundColor = '#4285f4';
  convertButton.style.color = 'white';
  convertButton.style.border = 'none';
  convertButton.style.borderRadius = '4px';
  convertButton.style.cursor = 'pointer';
  convertButton.style.fontFamily = 'Arial, sans-serif';
  convertButton.style.fontSize = '14px';
  convertButton.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
  
  // 添加点击事件
  convertButton.addEventListener('click', () => {
    // 通知background打开popup并处理选中的内容
    chrome.runtime.sendMessage({
      action: 'processSelectedElement',
      success: true
    });
    
    // 移除按钮
    buttonContainer.remove();
  });
  
  // 创建关闭按钮
  const closeButton = document.createElement('button');
  closeButton.textContent = '✕';
  closeButton.style.position = 'absolute';
  closeButton.style.top = '-8px';
  closeButton.style.right = '-8px';
  closeButton.style.width = '20px';
  closeButton.style.height = '20px';
  closeButton.style.borderRadius = '50%';
  closeButton.style.backgroundColor = '#ff4444';
  closeButton.style.color = 'white';
  closeButton.style.border = 'none';
  closeButton.style.cursor = 'pointer';
  closeButton.style.fontSize = '12px';
  closeButton.style.display = 'flex';
  closeButton.style.alignItems = 'center';
  closeButton.style.justifyContent = 'center';
  
  // 添加点击事件
  closeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    buttonContainer.remove();
  });
  
  // 组装按钮
  buttonContainer.appendChild(convertButton);
  buttonContainer.appendChild(closeButton);
  
  // 添加到页面
  document.body.appendChild(buttonContainer);
  
  // 30秒后自动移除
  setTimeout(() => {
    if (document.body.contains(buttonContainer)) {
      buttonContainer.remove();
    }
  }, 30000);
}