import { Toast, toaster } from '@kobalte/core/toast';
import styles from './style.module.css';

// タイプ別の通知ラッパー
export const message = {
  success: (msg: string) => {
    toaster.show((props) => (
      <Toast toastId={props.toastId} class={`${styles.toast} ${styles.success}`}>
        <Toast.Description class={styles.toastDescription}>
          {msg}
        </Toast.Description>
      </Toast>
    ));
  },
  error: (msg: string) => {
    toaster.show((props) => (
      <Toast toastId={props.toastId} class={`${styles.toast} ${styles.error}`}>
        <Toast.Description class={styles.toastDescription}>
          {msg}
        </Toast.Description>
      </Toast>
    ));
  },
  warning: (msg: string) => {
    toaster.show((props) => (
      <Toast toastId={props.toastId} class={`${styles.toast} ${styles.warning}`}>
        <Toast.Description class={styles.toastDescription}>
          {msg}
        </Toast.Description>
      </Toast>
    ));
  },
  info: (msg: string) => {
    toaster.show((props) => (
      <Toast toastId={props.toastId} class={`${styles.toast} ${styles.info}`}>
        <Toast.Description class={styles.toastDescription}>
          {msg}
        </Toast.Description>
      </Toast>
    ));
  },
};

/**
 * アプリのルート（App.tsx や Rootレイアウト）に配置するコンポーネント
 * （※ 公式のビューポート/リージョン表示用）
 */
export const MessageProvider = () => {
  return (
    <Toast.Region class={styles.toastRegion}>
      <Toast.List class={styles.toastList} />
    </Toast.Region>
  );
};
