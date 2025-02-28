document.addEventListener('DOMContentLoaded', () => {
  const shareLink = window.location.href; // e.g. "/rooms/:room_id/blocks/:block_id/edit"
  const linkInput = document.getElementById('myLinkInput');

  // Asignar la URL al span oculto
  if (linkInput) {
    console.log('setting text content of link input to', linkInput);
    linkInput.textContent = shareLink;
  }
});

// Función para mostrar/ocultar tooltip
function toggleTooltip(event, tooltipId) {
  event.stopPropagation(); // Evita que se cierre inmediatamente al hacer click
  const tooltip = document.getElementById(`${tooltipId}-tooltip`) 
    || document.getElementById(tooltipId); // por si no quieres el "-tooltip"

  if (!tooltip) return;

  // Si está oculto, lo mostramos; si está visible, lo ocultamos
  if (tooltip.classList.contains('hidden')) {
    tooltip.classList.remove('hidden');
    // Posicionar el tooltip cerca del icono o texto
    positionTooltip(event.currentTarget, tooltip);
    // Listener para clic fuera
    setTimeout(() => document.addEventListener('click', onClickOutside));
  } else {
    hideTooltip(tooltip);
  }

  function onClickOutside(e) {
    if (!tooltip.contains(e.target) && !event.currentTarget.contains(e.target)) {
      hideTooltip(tooltip);
      document.removeEventListener('click', onClickOutside);
    }
  }
}

function hideTooltip(tooltip) {
  tooltip.classList.add('hidden');
}

function positionTooltip(anchor, tooltip) {
  tooltip.style.position = 'absolute';
  tooltip.style.zIndex = '999999'; // Asegura que quede sobre la toolbar

  const anchorRect = anchor.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const offset = 6; // espacio entre anchor y tooltip

  // Calcula top/left para mostrarlo abajo del anchor
  let top = anchorRect.bottom + window.scrollY + offset;
  let left = anchorRect.left + window.scrollX + (anchorRect.width / 2) - (tooltipRect.width / 2);

  // Evita que se salga por la derecha
  if (left + tooltipRect.width > window.innerWidth - 10) {
    left = window.innerWidth - tooltipRect.width - 10;
  }
  // Evita que se salga por la izquierda
  if (left < 10) {
    left = 10;
  }

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}
