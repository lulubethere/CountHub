// DOM이 로드되면 실행 (WinForms의 Form_Load와 비슷)
document.addEventListener('DOMContentLoaded', function() {
  
    // 버튼과 결과 영역 가져오기 (WinForms의 컨트롤 참조와 비슷)
    const button = document.getElementById('myButton');
    const resultDiv = document.getElementById('result');
    
    let clickCount = 0;
    
    // 버튼 클릭 이벤트 (WinForms의 button_Click과 비슷)
    button.addEventListener('click', function() {
      clickCount++;
      resultDiv.innerHTML = `<p>버튼을 <strong>${clickCount}</strong>번 클릭했습니다!</p>`;
      
      // 콘솔에도 출력 (디버깅용)
      console.log(`클릭 횟수: ${clickCount}`);
    });
    
    // 초기 메시지 표시
    resultDiv.innerHTML = '<p>버튼을 클릭해보세요!</p>';
  });