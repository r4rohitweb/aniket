const journey = document.querySelector('#skills.skills-story');
if (journey) {
  const chapters = [...journey.querySelectorAll('.skills-chapter')];
  const count = journey.querySelector('[data-notebook-count]');
  let frame = 0;
  const update = () => {
    frame = 0;
    const focus = innerHeight * 0.45;
    let active = 0;
    chapters.forEach((chapter, index) => {
      if (chapter.getBoundingClientRect().top <= focus) active = index;
    });
    if (journey.dataset.step !== String(active)) journey.dataset.step = String(active);
    chapters.forEach((chapter, index) => chapter.classList.toggle('is-active', active === index));
    count.textContent = `${String(active + 1).padStart(2, '0')} / 04`;
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  addEventListener('intro:ready', schedule);
  document.fonts.ready.then(schedule);
  update();
}
