(function registerHabitFlowConsumptionModule(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('consumption')) return;

  function injectTimeProfilePeakStyle(document) {
    if (!document || document.getElementById('habitflow-time-profile-peak-style')) return;
    const style = document.createElement('style');
    style.id = 'habitflow-time-profile-peak-style';
    style.textContent = '.hf-time-peak-dot{display:none!important;}';
    document.head.appendChild(style);
  }

  function injectSmokingQuickCapturePolish(document) {
    if (!document || document.getElementById('habitflow-smoking-quick-capture-polish')) return;
    const style = document.createElement('style');
    style.id = 'habitflow-smoking-quick-capture-polish';
    style.textContent = `
      #screen-smoking .smoke-control-card {
        position: relative;
        overflow: hidden;
        display: grid;
        gap: 18px;
        padding: clamp(18px, 2.4vw, 28px) !important;
        border-radius: 34px !important;
        background:
          radial-gradient(circle at 16% 6%, rgba(74,215,209,.18), transparent 30%),
          radial-gradient(circle at 92% 0%, rgba(143,240,167,.13), transparent 28%),
          linear-gradient(180deg, rgba(255,255,255,.82), rgba(255,255,255,.64)) !important;
        border: 1px solid rgba(74,215,209,.16) !important;
        box-shadow: 0 24px 70px rgba(17,36,58,.08) !important;
      }

      #screen-smoking .smoke-control-card::after {
        content: '';
        position: absolute;
        inset: auto 22px -1px 22px;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(74,215,209,.52), transparent);
        pointer-events: none;
      }

      #screen-smoking .smoke-control-card > * {
        position: relative;
        z-index: 1;
      }

      #screen-smoking .smoke-control-card .panel-head.compact {
        align-items: flex-start;
        margin-bottom: 0;
      }

      #screen-smoking .smoke-control-card .panel-head.compact h3 {
        margin-top: 4px;
        font-size: clamp(1.22rem, 1.6vw, 1.55rem);
        letter-spacing: -.035em;
      }

      #screen-smoking .smoke-ring {
        min-height: clamp(168px, 19vw, 218px) !important;
        padding: clamp(22px, 3vw, 34px) !important;
        border-radius: 30px !important;
        display: grid !important;
        place-items: center !important;
        text-align: center;
        gap: 8px;
        background:
          radial-gradient(circle at 50% 8%, rgba(74,215,209,.24), transparent 38%),
          linear-gradient(180deg, rgba(255,255,255,.76), rgba(255,255,255,.46)) !important;
        border: 1px solid rgba(74,215,209,.18) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 18px 42px rgba(17,36,58,.045) !important;
      }

      #screen-smoking .smoke-ring small {
        color: var(--muted) !important;
        font-size: .72rem !important;
        font-weight: 760 !important;
        letter-spacing: .16em !important;
      }

      #screen-smoking .smoke-ring strong {
        margin: 2px 0 0;
        color: var(--ink) !important;
        font-size: clamp(3.3rem, 7.2vw, 5.25rem) !important;
        font-weight: 760 !important;
        letter-spacing: -.075em !important;
        line-height: .92 !important;
      }

      #screen-smoking .smoke-ring span {
        max-width: 520px;
        color: var(--muted) !important;
        font-size: .95rem !important;
        line-height: 1.45 !important;
      }

      #screen-smoking .pause-status-row {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px !important;
        margin: 0 !important;
      }

      #screen-smoking #smokePauseStatus.pause-status-pill {
        min-height: 48px;
        padding: 10px 14px !important;
        border-radius: 999px !important;
        background: rgba(255,255,255,.68) !important;
        border: 1px solid rgba(74,215,209,.14) !important;
        box-shadow: 0 12px 30px rgba(17,36,58,.045) !important;
      }

      #screen-smoking .pause-status-row > .mini-btn {
        min-height: 48px;
        padding-inline: 18px !important;
        border-radius: 999px !important;
        font-weight: 680 !important;
        color: var(--ink) !important;
        background: rgba(255,255,255,.58) !important;
        border: 1px solid rgba(17,36,58,.08) !important;
      }

      #screen-smoking .craving-coach-card {
        display: grid !important;
        gap: 12px !important;
        padding: clamp(16px, 2vw, 22px) !important;
        border-radius: 28px !important;
        background:
          linear-gradient(135deg, rgba(74,215,209,.14), rgba(102,231,255,.08) 45%, rgba(143,240,167,.12)) !important;
        border: 1px solid rgba(74,215,209,.18) !important;
        box-shadow: 0 16px 42px rgba(74,215,209,.085) !important;
      }

      #screen-smoking .craving-coach-head {
        align-items: flex-start !important;
        gap: 12px !important;
      }

      #screen-smoking .craving-coach-head h4 {
        margin-top: 4px;
        font-size: 1.08rem !important;
        letter-spacing: -.025em !important;
      }

      #screen-smoking .craving-coach-card p {
        margin: 0 !important;
        color: var(--muted) !important;
        font-size: .95rem !important;
        line-height: 1.55 !important;
      }

      #screen-smoking .craving-actions {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px !important;
        margin-top: 2px;
      }

      #screen-smoking .craving-actions .mini-btn {
        min-height: 46px;
        border-radius: 16px !important;
        font-weight: 720 !important;
      }

      #screen-smoking #recordSmokeBtn.smoke-button {
        min-height: 76px !important;
        width: 100%;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 14px !important;
        margin-top: 0 !important;
        border: 0 !important;
        border-radius: 26px !important;
        color: #182033 !important;
        font-size: 1.18rem !important;
        font-weight: 760 !important;
        letter-spacing: -.025em !important;
        background:
          linear-gradient(135deg, #ff7f75 0%, #ffb94d 100%) !important;
        box-shadow: 0 18px 42px rgba(255,145,92,.24), inset 0 1px 0 rgba(255,255,255,.35) !important;
        transform: translateZ(0);
      }

      #screen-smoking #recordSmokeBtn.smoke-button span {
        width: 38px !important;
        height: 38px !important;
        border-radius: 50% !important;
        display: grid !important;
        place-items: center !important;
        background: rgba(255,255,255,.32) !important;
        color: #182033 !important;
        font-size: 1.35rem !important;
        font-weight: 760 !important;
        line-height: 1 !important;
      }

      #screen-smoking #recordSmokeBtn.smoke-button:active {
        transform: translateY(1px) scale(.995);
      }

      body:not(.light) #screen-smoking .smoke-control-card {
        background:
          radial-gradient(circle at 14% 4%, rgba(74,215,209,.18), transparent 32%),
          radial-gradient(circle at 90% 0%, rgba(143,240,167,.12), transparent 30%),
          linear-gradient(180deg, rgba(15,25,39,.92), rgba(9,18,30,.84)) !important;
        border-color: rgba(74,215,209,.14) !important;
      }

      body:not(.light) #screen-smoking .smoke-ring,
      body:not(.light) #screen-smoking #smokePauseStatus.pause-status-pill,
      body:not(.light) #screen-smoking .pause-status-row > .mini-btn {
        background: rgba(255,255,255,.055) !important;
        border-color: rgba(255,255,255,.08) !important;
      }

      @media (min-width: 980px) {
        #screen-smoking .smoking-layout > .smoke-control-card {
          align-self: start;
        }
      }

      @media (max-width: 760px) {
        #screen-smoking .smoke-control-card {
          gap: 14px;
          padding: 16px !important;
          border-radius: 28px !important;
        }

        #screen-smoking .smoke-control-card .panel-head.compact h3 {
          font-size: 1.18rem;
        }

        #screen-smoking .smoke-ring {
          min-height: 148px !important;
          padding: 20px 16px !important;
          border-radius: 24px !important;
        }

        #screen-smoking .smoke-ring strong {
          font-size: clamp(3rem, 16vw, 4.4rem) !important;
        }

        #screen-smoking .smoke-ring span {
          font-size: .86rem !important;
        }

        #screen-smoking .pause-status-row {
          grid-template-columns: 1fr;
          gap: 10px !important;
        }

        #screen-smoking .pause-status-row > .mini-btn {
          width: 100%;
          justify-content: center;
        }

        #screen-smoking .craving-coach-card {
          padding: 15px !important;
          border-radius: 23px !important;
        }

        #screen-smoking .craving-actions {
          grid-template-columns: 1fr 1fr;
        }

        #screen-smoking #recordSmokeBtn.smoke-button {
          min-height: 66px !important;
          border-radius: 22px !important;
          font-size: 1.08rem !important;
        }

        #screen-smoking #recordSmokeBtn.smoke-button span {
          width: 34px !important;
          height: 34px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function loadConsumptionTimeProfile(document) {
    if (!document || document.getElementById('habitflow-consumption-time-profile-script')) return;
    const script = document.createElement('script');
    script.id = 'habitflow-consumption-time-profile-script';
    script.src = 'modules/consumption-time-profile.js';
    script.defer = true;
    document.head.appendChild(script);
  }

  function loadConsumptionYearOverview(document) {
    if (!document || document.getElementById('habitflow-consumption-year-overview-script')) return;
    const script = document.createElement('script');
    script.id = 'habitflow-consumption-year-overview-script';
    script.src = 'modules/consumption-year-overview.js';
    script.defer = true;
    document.head.appendChild(script);
  }

  injectTimeProfilePeakStyle(window.document);
  injectSmokingQuickCapturePolish(window.document);
  loadConsumptionTimeProfile(window.document);
  loadConsumptionYearOverview(window.document);

  modules.register('consumption', {
    description: 'Consumption domain boundary for smoking, alcohol, pauses, craving coach and deep analytics.',
    modes: Object.freeze(['smoke', 'alcohol']),
    dataTables: Object.freeze(['cigarette_events', 'alcohol_logs', 'alcohol_events', 'pause_periods']),
    migrationMode: 'preserve quick capture and analytics while moving pure calculations first',
    uiPatch: Object.freeze({
      loadsConsumptionTimeProfile: true,
      loadsConsumptionYearOverview: true,
      hidesPeakDot: true,
      smokingQuickCapturePolish: true
    })
  });
})(window);
